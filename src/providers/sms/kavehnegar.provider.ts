import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

@Injectable()
export class KavehNegarProvider extends BaseProvider {
  readonly channel = 'sms' as const;

  private readonly baseUrl = 'https://api.kavenegar.com/v1';

  constructor(private readonly config: ConfigService) {
    super();
  }

  /** Resolve the API key lazily so the app can boot without SMS configured. */
  private getApiKey(): string {
    const apiKey = this.config.get<string>('KAVEHNEGAR_API_KEY');
    if (!apiKey) {
      throw new Error(
        'KavehNegar SMS provider is not configured (KAVEHNEGAR_API_KEY is missing)',
      );
    }
    return apiKey;
  }

  /** Sender lines configured via KAVEHNEGAR_LINES (comma-separated). */
  private getConfiguredLines(): string[] {
    const raw = this.config.get<string>('KAVEHNEGAR_LINES', '');
    return raw
      .split(',')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * Pick the sender line for this message:
   *  - requested + in the configured list → use it
   *  - requested + NOT in the list       → reject (unknown line)
   *  - not requested                     → first configured line (default)
   *  - nothing configured, none requested → undefined (KavehNegar account default)
   */
  private resolveSenderLine(requested?: string): string | undefined {
    const lines = this.getConfiguredLines();

    if (requested) {
      if (lines.length > 0 && !lines.includes(requested)) {
        throw new Error(
          `Sender line "${requested}" is not configured. Allowed lines: ${lines.join(', ')}`,
        );
      }
      return requested;
    }

    return lines[0];
  }

  async send(payload: NotificationPayload): Promise<void> {
    const url = `${this.baseUrl}/${this.getApiKey()}/sms/send.json`;
    const sender = this.resolveSenderLine(payload.sender);

    const params = new URLSearchParams({
      receptor: payload.recipient,
      message: payload.body,
    });
    if (sender) {
      params.set('sender', sender);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KavehNegar send failed: ${response.status} ${text}`);
    }

    this.logger.log(
      `SMS sent to ${payload.recipient}${sender ? ` via line ${sender}` : ''}`,
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.getApiKey()}/account/info.json`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}
