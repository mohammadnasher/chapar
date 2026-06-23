import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { ProviderFactory } from './provider.factory';
import { NotificationProvider } from './provider.interface';
import { FirebasePushProvider } from './push/firebase.provider';
import { RedisPubSubPushProvider } from './push/redis-pubsub.provider';

describe('ProviderFactory', () => {
  // A ConfigService stub whose get() honours the supplied FIREBASE_NOTIFICATION value.
  const makeConfig = (firebaseEnabled: boolean): ConfigService =>
    ({
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key === 'FIREBASE_NOTIFICATION' ? firebaseEnabled : defaultValue,
      ),
    }) as unknown as ConfigService;

  // Real provider instances are required because getProvider() uses `instanceof`.
  // Their constructors don't touch any infra (that happens in onModuleInit).
  const firebase = new FirebasePushProvider(makeConfig(false));
  const redis = new RedisPubSubPushProvider(makeConfig(false));

  const smsProvider: NotificationProvider = {
    channel: 'sms',
    send: jest.fn(),
    healthCheck: jest.fn(),
  };

  const buildFactory = (firebaseEnabled: boolean): ProviderFactory =>
    new ProviderFactory([smsProvider, firebase, redis], makeConfig(firebaseEnabled));

  it('selects the Firebase push provider when FIREBASE_NOTIFICATION is true', () => {
    const factory = buildFactory(true);

    expect(factory.getProvider('push')).toBe(firebase);
  });

  it('selects the Redis Pub/Sub push provider when FIREBASE_NOTIFICATION is false', () => {
    const factory = buildFactory(false);

    expect(factory.getProvider('push')).toBe(redis);
  });

  it('returns the provider matching a non-push channel', () => {
    const factory = buildFactory(false);

    expect(factory.getProvider('sms')).toBe(smsProvider);
  });

  it('throws when no provider is registered for the requested channel', () => {
    const factory = buildFactory(false);

    expect(() => factory.getProvider('email')).toThrow(NotFoundException);
  });

  it('throws when the selected push provider is not registered', () => {
    // FIREBASE_NOTIFICATION=true but only the Redis provider is available.
    const factory = new ProviderFactory([redis], makeConfig(true));

    expect(() => factory.getProvider('push')).toThrow(NotFoundException);
  });
});
