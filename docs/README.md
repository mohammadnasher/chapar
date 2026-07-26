# Chapar — API Docs & Developer Guide

This directory documents the Chapar REST API and how to work on the project.

- [`chapar.postman_collection.json`](chapar.postman_collection.json) — Postman collection for every endpoint.
- [`chapar.postman_environment.json`](chapar.postman_environment.json) — matching environment (`baseUrl`, `apiKey`).

---

## 1. Using the Postman collection

1. Open Postman → **Import** → drop in both JSON files from this directory.
2. Select the **Chapar — Local** environment (top-right dropdown).
3. Edit the environment and set:
   - `baseUrl` — where the API runs (default `http://localhost:3000`).
   - `apiKey` — the **plaintext** key whose SHA-256 (hex) hash is configured on the server as `API_KEY_HASH`.
4. Send requests. The `X-API-Key` header is injected automatically at the collection level, so you don't set it per request.

> The "Send Email Notification" and "Health Check" requests include test scripts; run the
> collection with the Postman **Collection Runner** to smoke-test a deployment.

---

## 2. API reference

Base URL: `{{baseUrl}}` (e.g. `http://localhost:3000`)

| Method | Path       | Auth        | Description                          |
| ------ | ---------- | ----------- | ------------------------------------ |
| `POST` | `/notify`  | `X-API-Key` | Queue a notification for delivery.   |
| `GET`  | `/logs`    | `X-API-Key` | Query the notification audit history.|
| `GET`  | `/health`  | public      | Liveness/readiness probe.            |
| `GET`  | `/metrics` | public      | Prometheus metrics.                  |

### `POST /notify`

Validates the payload, persists a `PENDING` audit record, enqueues a BullMQ job, and
returns immediately. Delivery happens asynchronously in a worker.

**Headers**

```
Content-Type: application/json
X-API-Key: <your-key>
```

**Body**

| Field       | Type                          | Required | Notes                                              |
| ----------- | ----------------------------- | -------- | -------------------------------------------------- |
| `channel`   | `"sms" \| "email" \| "push"` | yes      | Target channel.                                    |
| `recipient` | `string` (≤ 500)              | yes      | Phone number, email, device token, or user id.     |
| `template`  | `string` (≤ 200)              | yes      | Template id resolved from `src/templates/hbs/`.    |
| `subject`   | `string` (≤ 200)              | no       | Used by email/push; ignored by SMS.                |
| `sender`    | `string` (numeric, ≤ 50)      | no       | SMS only: the line to send from (e.g. `"10004346"`). Must be listed in `KAVEHNEGAR_LINES`; omit for the default (first) line. |
| `data`      | `object`                      | no       | Variables passed to the Handlebars template.       |

**Response — `202 Accepted`**

```json
{ "logId": "f7c1e0a2-1b2c-4d3e-9f8a-0b1c2d3e4f5a" }
```

**Errors**

- `400 Bad Request` — validation failed (unknown `channel`, missing `template`, extra fields, …).
- `401 Unauthorized` — missing or invalid `X-API-Key`.
- `429 Too Many Requests` — rate limit exceeded (default 100 req / 60 s per IP).

**Example**

```bash
curl -X POST "$BASE_URL/notify" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "channel": "email",
    "recipient": "user@example.com",
    "template": "welcome-email",
    "subject": "Welcome to Chapar",
    "data": { "name": "Ada", "appName": "Chapar" }
  }'
```

### `GET /logs`

Returns paginated audit records, newest first.

**Query parameters**

| Param     | Type                                  | Default | Notes                          |
| --------- | ------------------------------------- | ------- | ------------------------------ |
| `channel` | `"sms" \| "email" \| "push"`         | —       | Filter by channel.             |
| `status`  | `"PENDING" \| "SENT" \| "FAILED"`    | —       | Filter by delivery status.     |
| `from`    | ISO-8601 datetime                     | —       | Lower bound on `createdAt`.    |
| `to`      | ISO-8601 datetime                     | —       | Upper bound on `createdAt`.    |
| `page`    | integer ≥ 1                           | `1`     | Page number.                   |
| `limit`   | integer 1–100                         | `20`    | Page size.                     |

**Response — `200 OK`**

```json
{
  "data": [
    {
      "id": "f7c1e0a2-...",
      "channel": "email",
      "recipient": "user@example.com",
      "templateId": "welcome-email",
      "status": "SENT",
      "attempts": 1,
      "errorMessage": null,
      "createdAt": "2026-06-23T10:00:00.000Z",
      "updatedAt": "2026-06-23T10:00:01.200Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "pages": 1 }
}
```

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-06-23T10:00:00.000Z" }
```

### `GET /metrics`

Prometheus text exposition format. Key series:

| Metric                                       | Type      | Labels    |
| -------------------------------------------- | --------- | --------- |
| `notifications_sent_total`                   | counter   | `channel` |
| `notifications_failed_total`                 | counter   | `channel` |
| `notification_processing_duration_seconds`   | histogram | `channel` |
| `notification_queue_depth`                   | gauge     | `queue`   |

---

## 3. Delivery & resiliency model

```
POST /notify ─▶ validate ─▶ persist PENDING ─▶ enqueue (BullMQ)
                                                     │
                                          worker picks up job
                                                     │
                              render template ─▶ select provider ─▶ send
                                                     │
                        success ─▶ status = SENT          failure ─▶ throw
                                                                       │
                                          BullMQ retries (exponential backoff)
                                          up to 5 attempts, then status = FAILED
```

- **Retries:** 5 attempts, exponential backoff starting at 2 s.
- **Audit:** every attempt updates the `NotificationLog` row (`attempts`, `status`, `errorMessage`).
- **Provider down:** the job stays queued and retries until it succeeds or attempts are exhausted.

---

## 4. Developer guidelines

### Prerequisites

- Node.js 22+, pnpm 9+, Docker.

### First-time setup

```bash
pnpm install
cp .env.example .env

# Generate the SHA-256 (hex) hash for your API key and paste it into API_KEY_HASH
node -e "console.log(require('crypto').createHash('sha256').update('your-secret-key').digest('hex'))"

# Bring up Postgres + Redis via Docker
docker compose up -d postgres redis

# Apply migrations on startup (set RUN_MIGRATIONS=true in .env), then run in watch mode
pnpm start:dev
```

### Common scripts

| Command            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `pnpm start:dev`   | Run with hot reload.                     |
| `pnpm build`       | Compile to `dist/`.                      |
| `pnpm test`        | Unit tests.                              |
| `pnpm test:e2e`    | End-to-end tests.                        |
| `pnpm lint`        | ESLint (autofix).                        |
| `pnpm format`      | Prettier write.                          |

### Project layout

```
src/
├── config/         # env validation (Joi) + database config
├── common/         # guards, filters, interceptors
├── notification/   # controller, service, DTOs, entity
├── providers/      # strategy-pattern providers + factory
├── queue/          # BullMQ queue + worker processor
├── templates/      # Handlebars service + .hbs files
└── metrics/        # Prometheus metrics
```

### Adding a new provider (e.g. Telegram)

The strategy pattern means **no core code changes** are required.

1. Create `src/providers/<channel>/telegram.provider.ts` extending `BaseProvider`:

   ```ts
   @Injectable()
   export class TelegramProvider extends BaseProvider {
     readonly channel = 'telegram' as const;

     async send(payload: NotificationPayload): Promise<void> {
       // call the Telegram Bot API
     }
   }
   ```

2. Register it in `src/providers/providers.module.ts` (add to the `providers` array and
   the `NOTIFICATION_PROVIDERS` factory).
3. Extend the `channel` union in `provider.interface.ts` and the `NotificationChannel`
   enum / DTO so requests can target it.
4. Add a unit test mirroring `provider.factory.spec.ts`.

### Adding a new template

Drop a `<template-id>.hbs` file into `src/templates/hbs/`. It is compiled and cached on
first use; reference it by filename (without extension) as the `template` field.

### Testing notes

E2E tests run under standard CommonJS `ts-jest`. Because `@mikro-orm/*` and `uuid` v14
are ESM-only, they are mapped to lightweight stubs in [`../test/stubs/`](../test/stubs)
via `moduleNameMapper` in `test/jest-e2e.json` — the database and queue layers are mocked,
so no Postgres or Redis is needed to run the suite.

### Commit conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `style:`, `build:`). Keep commits small and
focused.

---

## Author

**Mohammad Nasher** — [nasher.themo@gmail.com](mailto:nasher.themo@gmail.com)
