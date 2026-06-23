import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { NotificationLog, NotificationLogSchema } from './entities/notification-log.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([NotificationLog]),
    QueueModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
