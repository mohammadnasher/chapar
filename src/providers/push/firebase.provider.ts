import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, App } from 'firebase-admin/app';
import { cert } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

@Injectable()
export class FirebasePushProvider extends BaseProvider implements OnModuleInit {
  readonly channel = 'push' as const;

  private app!: App;
  private messaging!: Messaging;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit() {
    const credentialsJson = this.config.getOrThrow<string>('FIREBASE_CREDENTIALS_JSON');
    const credentials = JSON.parse(
      Buffer.from(credentialsJson, 'base64').toString('utf8'),
    );

    this.app = initializeApp({
      credential: cert(credentials),
    }, `chapar-${Date.now()}`);

    this.messaging = getMessaging(this.app);
  }

  async send(payload: NotificationPayload): Promise<void> {
    await this.messaging.send({
      token: payload.recipient,
      notification: {
        title: payload.subject ?? 'Notification',
        body: payload.body,
      },
    });

    this.logger.log(`FCM push sent to device token ${payload.recipient.slice(0, 12)}…`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Dry-run with an invalid token; Firebase returns an error but confirms connectivity
      await this.messaging.send(
        { token: 'health-check', notification: { title: 'ping' } },
        true,
      );
      return true;
    } catch (err: any) {
      const reachable = ['messaging/invalid-argument', 'messaging/registration-token-not-registered'];
      return reachable.includes(err?.errorInfo?.code);
    }
  }
}
