import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

@Injectable()
export class SmtpEmailProvider extends BaseProvider implements OnModuleInit {
  readonly channel = 'email' as const;

  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<number>('SMTP_PORT', 587) === 465,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async send(payload: NotificationPayload): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM', 'noreply@chapar.io'),
      to: payload.recipient,
      subject: payload.subject ?? 'Notification',
      html: payload.body,
    });

    this.logger.log(`Email sent to ${payload.recipient}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
