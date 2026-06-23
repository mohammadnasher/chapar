import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationProvider, NOTIFICATION_PROVIDERS } from './provider.interface';
import { FirebasePushProvider } from './push/firebase.provider';
import { RedisPubSubPushProvider } from './push/redis-pubsub.provider';

@Injectable()
export class ProviderFactory {
  constructor(
    @Inject(NOTIFICATION_PROVIDERS) private readonly providers: NotificationProvider[],
    private readonly config: ConfigService,
  ) {}

  getProvider(channel: NotificationChannel): NotificationProvider {
    if (channel === 'push') {
      const useFirebase = this.config.get<boolean>('FIREBASE_NOTIFICATION', false);
      const pushProviders = this.providers.filter((p) => p.channel === 'push');
      const selected = pushProviders.find(
        (p) =>
          (useFirebase && p instanceof FirebasePushProvider) ||
          (!useFirebase && p instanceof RedisPubSubPushProvider),
      );
      if (!selected) {
        throw new NotFoundException(`No push provider configured for FIREBASE_NOTIFICATION=${useFirebase}`);
      }
      return selected;
    }

    const provider = this.providers.find((p) => p.channel === channel);
    if (!provider) {
      throw new NotFoundException(`No provider registered for channel: ${channel}`);
    }
    return provider;
  }
}
