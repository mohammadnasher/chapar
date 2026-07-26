export type NotificationChannel = 'sms' | 'email' | 'push';

export interface NotificationPayload {
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  /** Sender identity, e.g. the SMS line number to send from (provider-specific). */
  sender?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export const NOTIFICATION_PROVIDERS = 'NOTIFICATION_PROVIDERS';
