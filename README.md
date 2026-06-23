# Chapar

> A generic, multi-channel notification gateway for microservices.

Chapar (Persian: چاپار — *courier*) is an open-source notification gateway built with
[NestJS](https://nestjs.com/). It accepts notification requests (SMS, Email, Push) from
other services and reliably dispatches them through pluggable providers, with queued
delivery, automatic retries, and full audit history.

## Features

- **Multi-channel** — SMS, Email, and Push out of the box.
- **Strategy-pattern providers** — add a new channel by implementing one interface; no core changes required.
- **Pluggable push delivery** — Firebase Cloud Messaging **or** in-app delivery via Redis Pub/Sub, switchable by config.
- **Reliable queueing** — [BullMQ](https://docs.bullmq.io/) + Redis with exponential backoff and configurable retries.
- **Template management** — [Handlebars](https://handlebarsjs.com/) templates rendered from `{ template, data }` payloads.
- **Audit trail** — every attempt is persisted to PostgreSQL (`PENDING` → `SENT` / `FAILED`).
- **Observability** — Prometheus metrics at `/metrics`.
- **Production-ready** — Docker, Docker Compose, and Kubernetes manifests included.
- **Secure by default** — API-key auth, rate limiting, Helmet headers, strict input validation.

## Architecture

```
                  ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
  POST /notify ──▶│  API (NestJS)│─────▶│ BullMQ/Redis│─────▶│   Worker(s)  │
                  │  validate +  │ enqueue              │ pick │  render tmpl │
                  │  persist log │      └─────────────┘ job   │  + send via  │
                  └──────┬───────┘                            │  Provider    │
                         │                                    └──────┬───────┘
                         ▼                                           ▼
                  ┌──────────────┐                          ┌──────────────┐
                  │  PostgreSQL  │◀─────── status update ───│  SMS / Email │
                  │ (audit logs) │                          │  / Push      │
                  └──────────────┘                          └──────────────┘
```

The API layer and workers scale independently — spin up more workers to drain a large
queue without touching the API.

### Roles (`CHAPAR_ROLE`)

The same image runs in one of three roles, selected by the `CHAPAR_ROLE` env var:

| Role               | Serves HTTP (`/notify`, `/logs`) | Consumes the queue (sends) | Use it for                        |
| ------------------ | -------------------------------- | -------------------------- | --------------------------------- |
| `api`              | ✅                               | ❌                         | Public ingress, scale with traffic |
| `worker`           | health/metrics only              | ✅                         | Sending, scale with throughput     |
| `all` *(default)*  | ✅                               | ✅                         | Local dev / small single-process deploys |

Both `api` and `worker` still expose `/health` and `/metrics` (so Kubernetes can probe
and Prometheus can scrape the send/fail counters, which are incremented worker-side).
`docker-compose.yml` runs `api` + `worker`; a bare `pnpm start:dev` defaults to `all`.

## Tech Stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Framework      | NestJS                          |
| ORM / Database | MikroORM + PostgreSQL           |
| Queue          | BullMQ + Redis                  |
| Templating     | Handlebars                      |
| Metrics        | Prometheus (`prom-client`)      |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for the Compose stack)

### Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# edit .env — at minimum set DATABASE_URL, REDIS_URL and API_KEY_HASH

# 3. Generate an API key hash (SHA-256 hex of your key)
node -e "console.log(require('crypto').createHash('sha256').update('your-secret-key').digest('hex'))"
# paste the result into API_KEY_HASH

# 4. Apply database migrations on startup
# set RUN_MIGRATIONS=true in .env (the app runs pending migrations when it boots)

# 5. Start in watch mode
pnpm start:dev
```

### Run the full stack with Docker Compose

```bash
cp .env.example .env   # set POSTGRES_PASSWORD and REDIS_PASSWORD
docker compose up --build
```

This starts the API, two workers, PostgreSQL, and Redis.

## API

All endpoints require an `X-API-Key` header.

### `POST /notify`

Queue a notification.

```bash
curl -X POST http://localhost:3000/notify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-key" \
  -d '{
    "channel": "email",
    "recipient": "user@example.com",
    "template": "welcome-email",
    "subject": "Welcome!",
    "data": { "name": "John", "appName": "Chapar" }
  }'
```

```json
{ "logId": "f7c1e0a2-..." }
```

### `GET /logs`

Query notification history (paginated, filterable by `channel`, `status`, `from`, `to`).

```bash
curl "http://localhost:3000/logs?status=SENT&channel=email&page=1&limit=20" \
  -H "X-API-Key: your-secret-key"
```

### `GET /health`

Unauthenticated liveness/readiness probe.

### `GET /metrics`

Prometheus scrape endpoint. Exposes `notifications_sent_total`,
`notifications_failed_total`, `notification_processing_duration_seconds`, and more.

## Push notifications: Firebase vs. in-app

The `push` channel supports two interchangeable strategies, selected by
`FIREBASE_NOTIFICATION`:

- `FIREBASE_NOTIFICATION=true` — deliver via **Firebase Cloud Messaging**
  (`recipient` is a device token).
- `FIREBASE_NOTIFICATION=false` — publish to **Redis Pub/Sub** on channel
  `notifications:<recipient>`. Your application subscribes to that channel and renders the
  notification in-app. Chapar is the publisher only.

## Adding a new provider

Thanks to the strategy pattern, adding a channel (e.g. Telegram) requires no changes to
the core pipeline:

1. Create a class extending `BaseProvider` and implementing `send()`.
2. Register it in `ProvidersModule`.

```ts
@Injectable()
export class TelegramProvider extends BaseProvider {
  readonly channel = 'telegram' as const;

  async send(payload: NotificationPayload): Promise<void> {
    // call the Telegram Bot API
  }
}
```

👉 For the full step-by-step walkthrough (config, factory wiring, migrations, tests), see
the **[provider guide in CONTRIBUTING.md](CONTRIBUTING.md#adding-a-notification-provider)**.

## Configuration

See [`.env.example`](.env.example) for the full list. Configuration is validated with Joi
at startup — the app refuses to boot with missing or invalid values.

## Deployment

Kubernetes manifests live in [`k8s/`](k8s/) (Deployments, Service, Ingress with TLS,
HPA, PodDisruptionBudget, and a Prometheus `ServiceMonitor`):

```bash
kubectl apply -k k8s/
```

## Testing

```bash
pnpm test       # unit tests
pnpm test:e2e   # end-to-end tests
```

## Contributing

Contributions are welcome — new providers and channels especially! Please read
**[CONTRIBUTING.md](CONTRIBUTING.md)** for the development workflow, coding standards,
commit conventions, and a step-by-step guide to
[adding a notification provider](CONTRIBUTING.md#adding-a-notification-provider).

For anything substantial, open an issue first so we can align on the approach.

## Author

**Mohammad Nasher** — [nasher.themo@gmail.com](mailto:nasher.themo@gmail.com)

## License

[MIT](LICENSE)
