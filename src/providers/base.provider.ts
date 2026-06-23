import { Logger } from '@nestjs/common';
import { NotificationChannel, NotificationPayload, NotificationProvider } from './provider.interface';

export abstract class BaseProvider implements NotificationProvider {
  abstract readonly channel: NotificationChannel;

  protected readonly logger = new Logger(this.constructor.name);

  abstract send(payload: NotificationPayload): Promise<void>;

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
