<div align="center">

# Velo API

A multi-tenant project management API for organizations, teams, projects, and tasks, with real-time collaboration, background jobs, billing, and AI-assisted planning built in.

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-8-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-UNLICENSED-lightgrey)](LICENSE)

[Live API](https://velo-app.up.railway.app) · [Swagger Docs](https://velo-app.up.railway.app/api-docs)

</div>

## Features

### Authentication & Security

- **Multi-Strategy Authentication** - Sign up and sign in with email/password, Google OAuth, or GitHub OAuth
- **JWT Access & Refresh Tokens** - Access and refresh tokens with secure storage in `redis`, not on the `User` model
- **Two-Factor Authentication** - TOTP-based 2FA with QR codes via `otplib` and `qrcode`
- **Role-Based Access Control** - Granular roles and permissions through `RolesGuard`
- **Account Enforcement** - Ban or suspend users with `BanGuard`
- **Idempotency Keys** - Safe retry semantics for critical operations
- **Rate Limiting** - Global request throttling to prevent abuse
- **Hardened HTTP** - `Helmet` security headers, scoped `CORS`, and structured validation error responses

### Organizations & Teams

- **Multi-Tenant Organizations** - Create and manage isolated organizations
- **Team Management** - Organize users into teams within organizations
- **Member Invitations** - Invite and manage organization members

### Projects & Tasks

- **Project Lifecycle** - Create, update, and archive projects
- **Task Management** - Full CRUD for tasks with assignments and statuses
- **Attachments** - File uploads via Cloudinary
- **Soft Delete & Restore** - Tasks are soft-deleted and recoverable rather than destroyed
- **Watchers** - Subscribe to a task to be notified when it changes
- **Activity Tracking** - Audit log of all project and task activities

### Real-Time

- **Live Updates** - WebSocket-powered real-time notifications and events via Socket.IO
- **Redis Adapter** - Scale WebSocket connections horizontally
- **Personal Notification Channel** - Per-user room for push-style in-app notifications

### Comments & Discussions

- **Threaded Comments** - Comment on tasks and projects
- **Mentions** - Mention users in comments

### Notifications & Email

- **Real-Time Notifications** - In-app notification feed via WebSocket
- **Delivery Tracking** - Track notification read status
- **Transactional Email** - Nodemailer + Handlebars templates, sent asynchronously through a BullMQ queue

### Background Jobs & Scheduling

- **BullMQ Queues** - Dedicated queues for email delivery, Excel export, and realtime session eviction
- **Scheduled Jobs** - Cron-based due-date reminders, subscription-expiry checks, recurring exports, and cleanup tasks, all on UTC schedules

### Billing

- **Stripe Integration** - Payment processing and subscription management
- **Webhook Handling** - Secure Stripe webhook processing
- **Plan Tiers** - Free, Pro, and Business plans mapped to Stripe price IDs at the organization level

### AI-Powered Features

- **Smart Analysis** - Groq-powered AI content analysis and assistance
- **Automated Insights** - AI-driven summaries and recommendations

### Media & Files

- **File Uploads** - Upload images and documents via Cloudinary
- **Static Assets** - Serve static files with ServeStaticModule

### Admin

- **Platform Stats & User Management** - Ban, unban, restore, and promote users
- **Org Overrides** - Manually change an organization's plan
- **Task Recovery** - Restore soft-deleted tasks
- **Queue Inspection** - View and retry failed BullMQ jobs from the API
- **Audit Log** - Query the platform-wide audit trail

### Data Export

- **Excel Export** - Generate `.xlsx` exports on demand or on a schedule

### Infrastructure

- **Health Checks** - Terminus health endpoints for monitoring
- **Structured Logging** - Pino-based structured logging with pretty printing
- **Response Standardization** - Unified API response format with interceptors
- **Exception Handling** - Global exception filters for Prisma and HTTP errors
- **Caching Layer** - Redis-backed caching for performance

## Tech Stack

### Core

- **NestJS** 11 - Progressive Node.js framework
- **TypeScript** 5.7 - Type-safe JavaScript
- **Prisma** 7.8 - Type-safe ORM, using driver adapters (`@prisma/adapter-pg`)
- **PostgreSQL** - Primary database

### Authentication

- **Passport.js** - JWT, Google, GitHub, and local strategies
- **JWT** - Token-based authentication
- **bcryptjs** - Password hashing
- **otplib** + **qrcode** - TOTP/2FA generation

### Real-Time & Caching

- **Socket.IO** - WebSocket server for real-time features
- **Redis** - Pub/Sub for WebSocket scaling and caching

### Storage & Media

- **Cloudinary** - Cloud-based image and video management
- **Multer** - File upload handling

### Background Processing

- **BullMQ** - Redis-based job queue
- **Node Schedule** - Cron-based scheduled jobs

### Payments

- **Stripe** - Subscription and payment processing

### AI

- **Groq SDK** - AI-powered content analysis

### External Services

- **Nodemailer** - Email sending with Handlebars templates
- **Google Auth Library** - OAuth verification

### Observability

- **nestjs-pino** - Structured logging
- **@nestjs/terminus** - Health checks
- **Swagger / OpenAPI** - Auto-generated API documentation

### Testing

- **Jest** - Unit and integration testing
- **SuperTest** - HTTP assertion library

## Getting Started

### Prerequisites

- Node.js 22+ (the Docker images use Node 24)
- pnpm
- PostgreSQL and Redis, either running locally or through the provided Docker Compose setup

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/mdawoud27/velo.git
   cd velo
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure environment variables:

   Create a `.env` file in the project root with the variables listed under [Environment Variables](#environment-variables).

4. Generate the Prisma client:

   ```bash
   pnpm db:generate
   ```

5. Start the development server:

   ```bash
   pnpm start:dev
   ```

The API is now running at `http://localhost:3000`, with interactive docs at `http://localhost:3000/api-docs`.

## Scripts

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `pnpm start:dev`    | Start dev server with hot reload |
| `pnpm start`        | Start the server                 |
| `pnpm start:prod`   | Start production server          |
| `pnpm build`        | Build for production             |
| `pnpm test`         | Run unit tests                   |
| `pnpm test:cov`     | Run tests with coverage          |
| `pnpm test:e2e`     | Run end-to-end tests             |
| `pnpm db:deploy`    | Deploy database migrations       |
| `pnpm db:create`    | Create new migration             |
| `pnpm db:generate`  | Generate Prisma client           |
| `pnpm db:reset`     | Reset database                   |
| `pnpm lint`         | Run ESLint with auto-fix         |
| `pnpm lint:check`   | Run ESLint without fixing        |
| `pnpm format`       | Format code with Prettier        |
| `pnpm format:check` | Check code formatting            |

## API Documentation

The API is documented with Swagger. Once the server is running, visit:

- `http://localhost:3000/api-docs`: Swagger UI
- `http://localhost:3000/api-docs/json`: raw OpenAPI JSON

All routes are versioned under the `/api/v1` prefix (the root and `/health` are excluded).

Want more detail? The full endpoint list, WebSocket events, ERD, and Prisma schema all live in [`docs/`](./docs). Start with [`docs/README.md`](./docs/README.md).

## Docker

### Local Development

```bash
# Builds the dev image for the first time or after adding new dependencies (need to rebuild)
docker compose -f docker-compose.dev.yml up --build

# Subsequent runs
docker compose -f docker-compose.dev.yml up
```

### Production

```bash
# Build the app image
docker compose -f docker-compose.yml up -d --build

# Just rebuild without starting (e.g. after editing the Dockerfile)
docker compose build app

# Rebuild + restart only the app after a code change, leave DB/Redis alone
docker compose up -d --build app

# Stop and remove containers (network too), keep volumes
docker compose down
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GITHUB_CLIENT_ID_DEV` / `GITHUB_CLIENT_ID_PROD` | GitHub OAuth client ID (dev / prod) |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `CLOUDINARY_NAME` | Cloudinary cloud name |
| `GROQ_API_KEY` | Groq API key for AI features |
| `FRONTEND_URL` | URL of the frontend application |

## Git Workflow

```markdown
main (production) ← dev (staging) ← feat/<name> | fix/<name> | refactor/<name>
```

- `main` and `dev` are protected: no force-pushes, no merge commits. History stays linear.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Every PR against `main`/`dev` runs lint, format, and validation checks in CI, plus gets its own scratch database branch for the lifetime of the PR.

Full guide: [`docs/github-flow.md`](./docs/github-flow.md)

## Code Quality

The project enforces code quality with:

- **ESLint** - Linting with TypeScript rules
- **Prettier** - Code formatting
- **Husky** - Git hooks for pre-commit checks
- **TypeScript** - Strict type checking

## License

This project is licensed under the [MIT License](LICENSE).
