import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/core';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NotificationLog,
  NotificationChannel,
  NotificationStatus,
} from './entities/notification-log.entity';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryLogsDto } from './dto/query-logs.dto';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOB } from '../queue/queue.constants';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationLog)
    private readonly logsRepo: EntityRepository<NotificationLog>,
    private readonly em: EntityManager,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  async dispatch(dto: SendNotificationDto): Promise<{ logId: string }> {
    const log = new NotificationLog();
    log.channel = dto.channel as unknown as NotificationChannel;
    log.recipient = dto.recipient;
    log.templateId = dto.template;
    log.variables = dto.data ?? {};
    log.status = NotificationStatus.PENDING;

    this.em.persist(log);
    await this.em.flush();

    await this.queue.add(
      NOTIFICATION_JOB,
      {
        logId: log.id,
        channel: dto.channel,
        recipient: dto.recipient,
        templateId: dto.template,
        variables: dto.data ?? {},
        subject: dto.subject,
        sender: dto.sender,
      },
      {
        jobId: `notif-${log.id}`,
      },
    );

    return { logId: log.id };
  }

  async getLogs(query: QueryLogsDto) {
    const filters: Record<string, unknown> = {};

    if (query.channel) filters.channel = query.channel;
    if (query.status) filters.status = query.status;
    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter['$gte'] = new Date(query.from);
      if (query.to) dateFilter['$lte'] = new Date(query.to);
      filters.createdAt = dateFilter;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.logsRepo.findAndCount(filters, {
      orderBy: { createdAt: 'DESC' as any },
      limit,
      offset: (page - 1) * limit,
    });

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
