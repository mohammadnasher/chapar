export const NOTIFICATION_QUEUE = 'notification';
export const NOTIFICATION_JOB = 'dispatch';

export interface NotificationJobData {
  logId: string;
  channel: 'sms' | 'email' | 'push';
  recipient: string;
  templateId: string;
  variables: Record<string, unknown>;
  subject?: string;
}
