import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

@Injectable()
export class KavehNegarProvider extends BaseProvider {
  readonly channel = 'sms' as const;

  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.kavenegar.com/v1';

  constructor(private readonly config: ConfigService) {
    super();
    this.apiKey = this.config.getOrThrow<string>('KAVEHNEGAR_API_KEY');
  }

  async send(payload: NotificationPayload): Promise<void> {
    const url = `${this.baseUrl}/${this.apiKey}/sms/send.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        receptor: payload.recipient,
        message: payload.body,
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KavehNegar send failed: ${response.status} ${text}`);
    }

    this.logger.log(`SMS sent to ${payload.recipient}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.apiKey}/account/info.json`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}
