import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  NotificationLog,
  NotificationLogSchema,
} from './entities/notification-log.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { QueueModule } from '../queue/queue.module';
import { runsApi } from '../config/runtime';

@Module({
  imports: [MikroOrmModule.forFeature([NotificationLog]), QueueModule],
  // The public notify/logs endpoints are exposed by API-capable roles only; a
  // pure worker has no need to accept HTTP notifications.
  controllers: runsApi() ? [NotificationController] : [],
  providers: runsApi() ? [NotificationService] : [],
})
export class NotificationModule {}
