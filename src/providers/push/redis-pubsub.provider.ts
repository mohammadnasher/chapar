import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

export interface InAppNotificationRecord {
  id: string;
  body: string;
  subject?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

@Injectable()
export class RedisPubSubPushProvider
  extends BaseProvider
  implements OnModuleInit, OnModuleDestroy
{
  readonly channel = 'push' as const;

  private publisher?: Redis;
  private readonly channelPrefix: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.channelPrefix = this.config.get<string>(
      'REDIS_PUBSUB_CHANNEL_PREFIX',
      'notifications',
    );
  }

  onModuleInit() {
    // Only connect when Redis Pub/Sub is the selected push strategy, so the app
    // can boot (and skip this connection) when push is delivered via Firebase.
    if (this.config.get<boolean>('FIREBASE_NOTIFICATION', false)) {
      return;
    }

    const pubsubUrl = this.config.getOrThrow<string>('REDIS_PUBSUB_URL');
    this.publisher = new Redis(pubsubUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  async onModuleDestroy() {
    await this.publisher?.quit();
  }

  private getPublisher(): Redis {
    if (!this.publisher) {
      throw new Error(
        'Redis Pub/Sub push provider is not configured (set FIREBASE_NOTIFICATION=false and REDIS_PUBSUB_URL)',
      );
    }
    return this.publisher;
  }

  async send(payload: NotificationPayload): Promise<void> {
    const redisChannel = `${this.channelPrefix}:${payload.recipient}`;

    const record: InAppNotificationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      body: payload.body,
      subject: payload.subject,
      metadata: payload.metadata,
      timestamp: new Date().toISOString(),
    };

    const subscribers = await this.getPublisher().publish(
      redisChannel,
      JSON.stringify(record),
    );

    this.logger.log(
      `In-app notification published to channel "${redisChannel}" — ${subscribers} subscriber(s)`,
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.getPublisher().ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
