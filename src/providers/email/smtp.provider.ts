import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

@Injectable()
export class SmtpEmailProvider extends BaseProvider {
  readonly channel = 'email' as const;

  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    super();
  }

  /**
   * Build the transporter lazily on first use so the app can boot without SMTP
   * configured. Throws a clear error if email is used without configuration.
   */
  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      throw new Error(
        'SMTP email provider is not configured (SMTP_HOST, SMTP_USER and SMTP_PASS are required)',
      );
    }

    const port = this.config.get<number>('SMTP_PORT', 587);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    return this.transporter;
  }

  async send(payload: NotificationPayload): Promise<void> {
    await this.getTransporter().sendMail({
      from: this.config.get<string>('SMTP_FROM', 'noreply@chapar.io'),
      to: payload.recipient,
      subject: payload.subject ?? 'Notification',
      html: payload.body,
    });

    this.logger.log(`Email sent to ${payload.recipient}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getTransporter().verify();
      return true;
    } catch {
      return false;
    }
  }
}
