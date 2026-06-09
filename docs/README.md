# Velo Documentation

> **Velo** is a production-grade, multi-tenant task and project management API built with NestJS, TypeScript, PostgreSQL, Redis, Socket.IO, BullMQ, Stripe, and Groq AI.

## Docs Index

| File                                 | What it covers                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`erd-docs.md`](./erd-docs.md)       | Entity Relationship Diagram, all 15 entities, their fields, relationships, cascade rules, and a ready-to-use Miro diagram prompt                    |
| [`schema-docs.md`](./schema-docs.md) | Full Prisma schema, every model with annotated fields, enums, index strategy, Redis key patterns, and migration commands                            |
| [`api-docs.md`](./api-docs.md)       | REST API reference, all endpoints grouped by module with request/response shapes, auth requirements, WebSocket events, and the authorization matrix |

## System Overview

```bash
Organization
 └── Team
      └── Project
           └── Task
                ├── Comment       (with @mention parsing)
                ├── Attachment    (Cloudinary/S3, max 10 MB)
                ├── TaskWatcher   (notification subscriptions)
                └── ActivityLog   (immutable audit trail)
```

**Cross-cutting services:**

- **Auth**: JWT (access 15min, refresh 7d), Google OAuth, email verification, password reset. All token state in Redis, no token columns on the `User` model.
- **Real-time**: Socket.IO with Redis adapter. Project rooms for board updates, personal `user:{id}` rooms for notifications.
- **Background jobs**: BullMQ queues for email delivery, Excel export, and scheduled cron jobs (due-date reminders, subscription expiry warnings).
- **Billing**: Stripe Checkout, webhook handling, idempotent plan upgrades/downgrades via `StripeEvent` PK deduplication.
- **AI**: Groq SDK for task suggestions, streamed via SSE. Per-user rate limit: 10 requests/hour via Redis counter.
- **Admin**: Super-admin control plane: ban/unban users, inspect failed BullMQ jobs, view platform stats, restore soft-deleted tasks.

## Tech Stack

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Framework        | NestJS                                           |
| Database         | PostgreSQL via Prisma ORM                        |
| Cache & Queues   | Redis (ioredis, BullMQ, Socket.IO Redis adapter) |
| Real-time        | Socket.IO                                        |
| Auth             | Passport.js (JWT + Google OAuth)                 |
| File storage     | Cloudinary / AWS S3                              |
| Email            | Nodemailer + Handlebars templates                |
| Billing          | Stripe                                           |
| AI               | Groq SDK (streaming SSE)                         |
| Excel export     | ExcelJS                                          |
| Containerisation | Docker + Docker Compose                          |
| CI/CD            | GitHub Actions → Railway                         |

## References

| Resource       | URL                                                      |
| -------------- | -------------------------------------------------------- |
| Swagger UI     | `https://<host>/api/docs`                                |
| Health check   | `https://<host>/health`                                  |
| Stripe billing | `https://<host>/api/v1/billing/plans`                    |
| Prisma docs    | [https://www.prisma.io/docs](https://www.prisma.io/docs) |
| NestJS docs    | [https://docs.nestjs.com](https://docs.nestjs.com)       |
| BullMQ docs    | [https://docs.bullmq.io](https://docs.bullmq.io)         |
| Socket.IO docs | [https://socket.io/docs](https://socket.io/docs)         |
