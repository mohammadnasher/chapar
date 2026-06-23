import { Migration } from '@mikro-orm/migrations';

export class Migration20240101000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'push');
      CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED');

      CREATE TABLE notification_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel notification_channel NOT NULL,
        recipient VARCHAR(500) NOT NULL,
        template_id VARCHAR(200) NOT NULL,
        variables JSONB,
        status notification_status NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_notification_logs_status ON notification_logs(status);
      CREATE INDEX idx_notification_logs_channel ON notification_logs(channel);
      CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP TABLE notification_logs;
      DROP TYPE notification_status;
      DROP TYPE notification_channel;
    `);
  }
}
