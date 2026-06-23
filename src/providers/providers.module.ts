import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KavehNegarProvider } from './sms/kavehnegar.provider';
import { SmtpEmailProvider } from './email/smtp.provider';
import { FirebasePushProvider } from './push/firebase.provider';
import { RedisPubSubPushProvider } from './push/redis-pubsub.provider';
import { ProviderFactory } from './provider.factory';
import { NOTIFICATION_PROVIDERS } from './provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    KavehNegarProvider,
    SmtpEmailProvider,
    FirebasePushProvider,
    RedisPubSubPushProvider,
    {
      provide: NOTIFICATION_PROVIDERS,
      useFactory: (
        kavehNegar: KavehNegarProvider,
        smtp: SmtpEmailProvider,
        firebase: FirebasePushProvider,
        redisPubSub: RedisPubSubPushProvider,
      ) => [kavehNegar, smtp, firebase, redisPubSub],
      inject: [
        KavehNegarProvider,
        SmtpEmailProvider,
        FirebasePushProvider,
        RedisPubSubPushProvider,
      ],
    },
    ProviderFactory,
  ],
  exports: [ProviderFactory],
})
export class ProvidersModule {}
