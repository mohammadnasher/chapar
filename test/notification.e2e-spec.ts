import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EntityManager } from '@mikro-orm/core';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { getQueueToken } from '@nestjs/bullmq';
import * as request from 'supertest';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { NotificationController } from '../src/notification/notification.controller';
import { NotificationService } from '../src/notification/notification.service';
import {
  NotificationLog,
  NotificationStatus,
} from '../src/notification/entities/notification-log.entity';
import { NOTIFICATION_QUEUE } from '../src/queue/queue.constants';

describe('Notification (e2e)', () => {
  let app: INestApplication;

  // Mocked infrastructure — no real Postgres or Redis required.
  const queue = { add: jest.fn() };
  const em = {
    persist: jest.fn(),
    flush: jest.fn().mockResolvedValue(undefined),
  };
  const logsRepo = {
    findAndCount: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: getRepositoryToken(NotificationLog), useValue: logsRepo },
        { provide: EntityManager, useValue: em },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: queue },
      ],
    })
      // The guards depend on external state (bcrypt hash, throttler storage);
      // bypass them so we can exercise the controller logic directly.
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /notify', () => {
    it('persists a log, enqueues a job and returns 202 with the logId', async () => {
      const res = await request(app.getHttpServer())
        .post('/notify')
        .send({
          channel: 'email',
          recipient: 'user@example.com',
          template: 'welcome-email',
          subject: 'Hi',
          data: { name: 'Ada' },
        })
        .expect(202);

      expect(res.body).toHaveProperty('logId');
      expect(typeof res.body.logId).toBe('string');

      expect(em.persist).toHaveBeenCalledTimes(1);
      expect(em.flush).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledTimes(1);

      const [jobName, jobData] = queue.add.mock.calls[0];
      expect(jobName).toBe('dispatch');
      expect(jobData).toMatchObject({
        channel: 'email',
        recipient: 'user@example.com',
        templateId: 'welcome-email',
        subject: 'Hi',
        variables: { name: 'Ada' },
      });
    });

    it('rejects an invalid payload with 400', async () => {
      await request(app.getHttpServer())
        .post('/notify')
        .send({ channel: 'carrier-pigeon', recipient: 'user@example.com' })
        .expect(400);

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('GET /logs', () => {
    it('returns paginated logs with metadata', async () => {
      const items = [
        {
          id: 'log-1',
          channel: 'email',
          recipient: 'user@example.com',
          status: NotificationStatus.SENT,
        },
      ];
      logsRepo.findAndCount.mockResolvedValue([items, 1]);

      const res = await request(app.getHttpServer())
        .get('/logs')
        .query({ channel: 'email', page: 1, limit: 20 })
        .expect(200);

      expect(res.body).toEqual({
        data: items,
        meta: { total: 1, page: 1, limit: 20, pages: 1 },
      });

      const [filters] = logsRepo.findAndCount.mock.calls[0];
      expect(filters).toMatchObject({ channel: 'email' });
    });

    it('rejects an invalid query parameter with 400', async () => {
      await request(app.getHttpServer()).get('/logs').query({ limit: 9999 }).expect(400);

      expect(logsRepo.findAndCount).not.toHaveBeenCalled();
    });
  });
});
