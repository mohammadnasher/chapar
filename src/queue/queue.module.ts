import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { NotificationLog } from '../notification/entities/notification-log.entity';
import { ProvidersModule } from '../providers/providers.module';
import { TemplateModule } from '../templates/template.module';
import { MetricsModule } from '../metrics/metrics.module';
import { NotificationProcessor } from './notification.processor';
import { NOTIFICATION_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: false,
      },
    }),
    MikroOrmModule.forFeature([NotificationLog]),
    ProvidersModule,
    TemplateModule,
    MetricsModule,
  ],
  providers: [NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
