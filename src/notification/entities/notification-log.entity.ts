import { EntitySchema } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum NotificationChannel {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
}

export class NotificationLog {
  id: string = uuid();
  channel!: NotificationChannel;
  recipient!: string;
  templateId!: string;
  variables?: Record<string, unknown>;
  status: NotificationStatus = NotificationStatus.PENDING;
  errorMessage?: string;
  attempts: number = 0;
  createdAt: Date = new Date();
  updatedAt: Date = new Date();
}

export const NotificationLogSchema = new EntitySchema<NotificationLog>({
  class: NotificationLog,
  tableName: 'notification_logs',
  properties: {
    id: { type: 'uuid', primary: true },
    channel: { enum: true, items: () => Object.values(NotificationChannel) },
    recipient: { type: 'string', length: 500 },
    templateId: { type: 'string', fieldName: 'template_id', length: 200 },
    variables: { type: 'json', nullable: true },
    status: {
      enum: true,
      items: () => Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
    },
    errorMessage: { type: 'text', nullable: true, fieldName: 'error_message' },
    attempts: { type: 'integer', default: 0 },
    createdAt: { type: 'datetime', fieldName: 'created_at', onCreate: () => new Date() },
    updatedAt: { type: 'datetime', fieldName: 'updated_at', onUpdate: () => new Date() },
  },
});
