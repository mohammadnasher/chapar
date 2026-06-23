# Contributing to Chapar

First off — thank you for taking the time to contribute! 🎉 Chapar is built to make it
*easy* to add new notification channels and providers, so contributions of all sizes are
welcome.

This guide covers how to get set up, our conventions, and a step-by-step walkthrough for
the most common contribution: **adding a new provider**.

---

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Branching & commit conventions](#branching--commit-conventions)
- [Pull request process](#pull-request-process)
- [Coding standards](#coding-standards)
- [Adding a notification provider](#adding-a-notification-provider)
  - [Scenario A: new provider for an existing channel](#scenario-a-new-provider-for-an-existing-channel)
  - [Scenario B: a brand-new channel](#scenario-b-a-brand-new-channel)
- [Adding a template](#adding-a-template)

---

## Ways to contribute

- 🐛 **Report bugs** — open an issue with steps to reproduce.
- ✨ **Add a provider** — SMS, email, push, chat (Telegram, Slack), webhooks, …
- 📝 **Improve docs** — README, the [API & developer guide](docs/README.md), code comments.
- ✅ **Add tests** — coverage for providers, the queue, or the API.

For anything substantial, please **open an issue first** so we can align on the approach
before you invest time in a PR.

---

## Development setup

See the full setup in the [developer guide](docs/README.md#4-developer-guidelines). In short:

```bash
pnpm install
cp .env.example .env          # fill in at least DATABASE_URL, REDIS_URL, API_KEY_HASH
docker compose up -d postgres redis
pnpm start:dev
```

Before pushing, make sure these all pass:

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

---

## Branching & commit conventions

- Branch off `main`. Use a descriptive name: `feat/telegram-provider`, `fix/smtp-timeout`.
- We follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `style:`, `refactor:`, `build:`.
- Keep commits small and focused; each commit should build and pass tests.

Example:

```
feat(providers): add Telegram push provider
```

---

## Pull request process

1. Fork the repo and create your branch from `main`.
2. Make your change, including **tests** and **docs**.
3. Ensure `pnpm lint`, `pnpm build`, `pnpm test`, and `pnpm test:e2e` all pass.
4. Open a PR with a clear description of *what* and *why*. Link any related issue.
5. A maintainer will review. Address feedback by pushing follow-up commits.

---

## Coding standards

- **TypeScript strict mode** — no `any` unless truly unavoidable (and commented).
- **Formatting** is enforced by Prettier (`pnpm format`) and ESLint (`pnpm lint`).
- **No secrets in code.** All credentials come from environment variables, validated in
  [`src/config/app.config.ts`](src/config/app.config.ts).
- **Fail loudly on misconfiguration** — use `ConfigService.getOrThrow()` for required keys.

---

## Adding a notification provider

This is the headline use case. Thanks to the [Strategy pattern](https://refactoring.guru/design-patterns/strategy),
providers are self-contained and the core pipeline never needs to change.

### Key files

| File | Role |
| ---- | ---- |
| [`src/providers/provider.interface.ts`](src/providers/provider.interface.ts) | `NotificationProvider` interface, `NotificationPayload`, channel union, DI token |
| [`src/providers/base.provider.ts`](src/providers/base.provider.ts) | `BaseProvider` abstract class (gives you a `logger` and a default `healthCheck`) |
| [`src/providers/provider.factory.ts`](src/providers/provider.factory.ts) | Selects the right provider at runtime by `channel` |
| [`src/providers/providers.module.ts`](src/providers/providers.module.ts) | Registers providers in the DI container |

Every provider implements this contract:

```ts
export interface NotificationProvider {
  readonly channel: 'sms' | 'email' | 'push';
  send(payload: NotificationPayload): Promise<void>;
  healthCheck(): Promise<boolean>;
}
```

`BaseProvider` gives you a scoped `this.logger` and a default `healthCheck()` returning
`true`, so you usually only implement the `channel` field and `send()`.

---

### Scenario A: new provider for an existing channel

Example: adding **Twilio** as a second SMS provider alongside KavehNegar.

> ℹ️ Because more than one provider can serve a channel, you also pick **which** one is
> active via configuration — exactly like the push channel chooses between Firebase and
> Redis using `FIREBASE_NOTIFICATION`.

**1. Create the provider** — `src/providers/sms/twilio.provider.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';
import { NotificationPayload } from '../provider.interface';

@Injectable()
export class TwilioProvider extends BaseProvider {
  readonly channel = 'sms' as const;

  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.accountSid = this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN');
    this.from = this.config.getOrThrow<string>('TWILIO_FROM');
  }

  async send(payload: NotificationPayload): Promise<void> {
    // call the Twilio API; throw on failure so BullMQ retries with backoff
    this.logger.log(`SMS sent to ${payload.recipient}`);
  }
}
```

> 🔑 **Throw on failure.** If `send()` throws, BullMQ retries the job with exponential
> backoff and, after the max attempts, marks the audit log `FAILED`. Never swallow errors.

**2. Add config** to the Joi schema in [`src/config/app.config.ts`](src/config/app.config.ts)
and document the keys in [`.env.example`](.env.example):

```ts
SMS_PROVIDER: Joi.string().valid('kavehnegar', 'twilio').default('kavehnegar'),
TWILIO_ACCOUNT_SID: Joi.string().when('SMS_PROVIDER', { is: 'twilio', then: Joi.required() }),
TWILIO_AUTH_TOKEN:  Joi.string().when('SMS_PROVIDER', { is: 'twilio', then: Joi.required() }),
TWILIO_FROM:        Joi.string().when('SMS_PROVIDER', { is: 'twilio', then: Joi.required() }),
```

**3. Register it** in [`src/providers/providers.module.ts`](src/providers/providers.module.ts)
(add to the `providers` array, the `NOTIFICATION_PROVIDERS` factory, and its `inject` list).

**4. Teach the factory which SMS provider to use.** In
[`src/providers/provider.factory.ts`](src/providers/provider.factory.ts), mirror the
existing push logic so an SMS request resolves to the configured provider:

```ts
if (channel === 'sms') {
  const wanted = this.config.get<string>('SMS_PROVIDER', 'kavehnegar');
  const provider = this.providers.find(
    (p) =>
      p.channel === 'sms' &&
      ((wanted === 'twilio' && p instanceof TwilioProvider) ||
        (wanted === 'kavehnegar' && p instanceof KavehNegarProvider)),
  );
  if (!provider) throw new NotFoundException(`No SMS provider for SMS_PROVIDER=${wanted}`);
  return provider;
}
```

**5. Add a unit test** mirroring
[`src/providers/provider.factory.spec.ts`](src/providers/provider.factory.spec.ts).

---

### Scenario B: a brand-new channel

Example: adding a **`telegram`** channel.

**1. Extend the channel union** in [`src/providers/provider.interface.ts`](src/providers/provider.interface.ts):

```ts
export type NotificationChannel = 'sms' | 'email' | 'push' | 'telegram';
```

**2. Add the channel to the request DTO** —
[`src/notification/dto/send-notification.dto.ts`](src/notification/dto/send-notification.dto.ts):

```ts
export enum NotificationChannelDto {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH = 'push',
  TELEGRAM = 'telegram',
}
```

**3. Add the channel to the audit entity** —
[`src/notification/entities/notification-log.entity.ts`](src/notification/entities/notification-log.entity.ts)
(`NotificationChannel` enum) **and create a migration** to extend the Postgres enum:

```sql
ALTER TYPE notification_channel ADD VALUE 'telegram';
```

Put it in a new file under `src/migrations/` following the existing naming pattern.

**4. Create the provider** — `src/providers/telegram/telegram.provider.ts`, extending
`BaseProvider` with `readonly channel = 'telegram' as const` (see Scenario A for the shape).

**5. Register** it in [`src/providers/providers.module.ts`](src/providers/providers.module.ts).
The factory's generic fallback (`this.providers.find((p) => p.channel === channel)`) will
resolve it automatically — no factory change needed unless you have multiple Telegram
providers.

**6. Add config + env** in [`src/config/app.config.ts`](src/config/app.config.ts) and
[`.env.example`](.env.example) (e.g. `TELEGRAM_BOT_TOKEN`).

**7. Add a template** (see below) and **tests**.

#### Checklist for a new channel

- [ ] Channel added to the `NotificationChannel` union (`provider.interface.ts`)
- [ ] Channel added to `NotificationChannelDto` (`send-notification.dto.ts`)
- [ ] Channel added to the entity enum **and** a migration for the Postgres enum
- [ ] Provider class created and registered in `providers.module.ts`
- [ ] Env vars added to the Joi schema and `.env.example`
- [ ] Unit test for the provider / factory selection
- [ ] Docs updated (README channel list + `docs/README.md`)

---

## Adding a template

Drop a `<template-id>.hbs` file into [`src/templates/hbs/`](src/templates/hbs). It is
compiled and cached on first use; reference it by filename (without extension) as the
`template` field in a `POST /notify` request. Variables come from the request's `data`
object. The helper `{{currentYear}}` is available globally.

---

Thanks again for contributing to Chapar! If anything here is unclear, open an issue and
we'll improve this guide.
