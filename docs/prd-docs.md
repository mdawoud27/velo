# Product Requirements Document (PRD)

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Product Vision & Goals](#3-product-vision--goals)
4. [Stakeholders & User Personas](#4-stakeholders--user-personas)
5. [User Stories](#5-user-stories)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [System Architecture](#8-system-architecture)
9. [Data Models & ERD](#9-data-models--erd)
10. [API Design](#10-api-design)
11. [Security Requirements](#11-security-requirements)
12. [Infrastructure & DevOps](#12-infrastructure--devops)
13. [Testing Strategy](#13-testing-strategy)
14. [Future Roadmap](#14-future-roadmap)
15. [Success Metrics](#15-success-metrics)
16. [Glossary](#16-glossary)

---

## 1. Executive Summary

**Velo** is a full rebuild of [TaskTrial](https://github.com/TaskTrial/server-v1) (_Velo is the second version of TaskTrial_). It is a production-grade, multi-tenant task and project management API. Built with NestJS and TypeScript, it serves teams inside organizations with real-time collaboration, async background queues, AI-powered task suggestions, Stripe subscription billing, and a super-admin control plane.

The system models a three-level hierarchy: an **Organization** contains **Teams**, each Team manages **Projects**, and each Project contains **Tasks** that members collaborate on in real time via WebSockets. Background processing runs through BullMQ queues backed by Redis, covering email delivery, Excel exports, and scheduled due-date reminders via cron jobs. Subscription plans (Free / Pro / Business) gate access to advanced features via Stripe webhooks. A Redis caching layer reduces database load on hot read paths, and a distributed locking strategy prevents race conditions on concurrent writes.

The Velo codebase is designed as a portfolio-quality reference implementation demonstrating NestJS module architecture, Prisma ORM, Redis caching and pub/sub, Socket.IO gateways, BullMQ scheduled jobs, Stripe billing, Groq AI streaming, custom decorators, response transformation interceptors, and idempotency-safe endpoints, all containerised with Docker and deployed on Railway.

---

## 2. Problem Statement

The v1 TaskTrial was a functional graduation project but exposed several limitations that prevent it from being production-worthy:

- **No real-time updates**: team members had to refresh the page to see task changes made by others.
- **Synchronous email sending**: emails blocked API responses, increasing latency and risking timeouts.
- **No access tiers**: all features available to all users regardless of team size or plan.
- **No notifications**: users had no way to know when they were assigned a task or mentioned in a comment.
- **No AI assistance**: task creation required full manual input with no intelligent suggestions.
- **No scheduled jobs**: no due-date reminders, no subscription expiry warnings, no cron-based automation.
- **No admin control plane**: no way to manage users, organizations, or platform health from a privileged role.
- **No caching**: every request hit the database regardless of how frequently or how rarely the data changed.
- **JavaScript, not TypeScript**: no compile-time type safety, weaker tooling, harder to maintain at scale.
- **Limited test coverage**: no confidence in refactoring or adding new features without regressions.

Velo addresses every one of these gaps while adopting a strictly modular, testable, and deployable architecture.

---

## 3. Product Vision & Goals

### Vision

> Be the reference-quality open-source project management backend: modular, real-time, and a learning showcase for production NestJS patterns.

### Business Goals

- Provide a complete project lifecycle from organization setup through task completion.
- Support team collaboration through real-time task board updates and in-context comments.
- Enable sustainable growth with a subscription model that rewards larger teams.
- Offer AI-powered task suggestions to reduce friction in planning.

### Technical Goals

- Demonstrate production NestJS architecture: modules, providers, guards, interceptors, pipes, custom decorators.
- Enforce type safety end-to-end: TypeScript strict mode, Prisma-generated client, class-validator DTOs.
- Achieve reliable async processing: BullMQ email queue, Excel export queue, scheduled cron jobs, all with retry and dead-letter handling.
- Deliver real-time events at scale: Socket.IO with Redis adapter for horizontal scaling.
- Implement a Redis caching layer with explicit TTL and cache invalidation per resource type.
- Prevent race conditions with Redis distributed locking on concurrent write operations.
- Implement secure, idempotent billing: Stripe webhooks with signature verification and event deduplication.
- Apply idempotency keys on critical mutation endpoints to prevent double-submission.
- Produce HTML email templates using Handlebars, styled, branded, and maintainable.
- Reach 60%+ automated test coverage with unit and e2e suites.
- Generate full OpenAPI documentation from decorators, zero manual Swagger YAML.

---

## 4. Stakeholders & User Personas

### 4.1 Personas

#### Persona A - Organization Owner (Omar)

- **Who:** Runs a software agency or product company with multiple teams.
- **Goals:** Create the org, invite team leads, manage billing, see a bird's-eye view of all projects and progress.
- **Pain points:** Switching between billing tools, spreadsheets, and project boards. Wants everything in one API.
- **Technical comfort:** High, comfortable with API clients, reads Swagger docs directly.

#### Persona B - Team Admin / Lead (Sara)

- **Who:** A team lead or engineering manager responsible for one or more teams.
- **Goals:** Create and assign projects, manage team membership, track task progress, receive alerts on blockers.
- **Pain points:** No real-time awareness of what teammates are working on. Status updates come through Slack, not the tool itself.
- **Technical comfort:** Medium, high.

#### Persona C - Team Member (Youssef)

- **Who:** A developer, designer, or contributor working inside a team.
- **Goals:** Receive task assignments, update statuses, add comments, upload files, stay informed of changes.
- **Pain points:** Missing assignment notifications; has to ask colleagues for updates that should be automatic.
- **Technical comfort:** Medium.

#### Persona D - Developer / API Integrator

- **Who:** A front-end developer building a UI on top of the Velo API.
- **Goals:** Discover endpoints quickly via Swagger, integrate WebSocket events, handle consistent error shapes.
- **Technical comfort:** High.

#### Persona E - Platform Super Admin

- **Who:** The platform operator (Mohamed, as the developer and owner).
- **Goals:** View all registered users and organizations, ban abusive accounts, monitor platform health, inspect failed queue jobs, verify billing state.
- **Pain points:** No visibility into platform-wide activity without direct DB access.
- **Technical comfort:** Very high.

---

## 5. User Stories

### 5.1 Authentication & Account Management

| ID      | As a…                          | I want to…                                            | So that…                                         | Priority    |
| ------- | ------------------------------ | ----------------------------------------------------- | ------------------------------------------------ | ----------- |
| AUTH-01 | Visitor                        | Register with my email and password                   | I can create a TaskTrial account                 | Must Have   |
| AUTH-02 | Visitor                        | Register or log in with my Google account             | I can join without a separate password           | Must Have   |
| AUTH-03 | New user                       | Verify my email address via a link sent to my inbox   | My account is confirmed as legitimate            | Must Have   |
| AUTH-04 | Registered user                | Log in with email and password and receive JWT tokens | I can authenticate all API requests              | Must Have   |
| AUTH-05 | Authenticated user             | Refresh my access token using my refresh token        | I stay logged in without re-entering credentials | Must Have   |
| AUTH-06 | Authenticated user             | Log out and invalidate my refresh token               | My session is securely terminated                | Must Have   |
| AUTH-07 | User who forgot their password | Request a password-reset link via email               | I can recover access to my account               | Must Have   |
| AUTH-08 | User with a reset link         | Set a new password using the reset token              | I regain access to my account                    | Must Have   |
| AUTH-09 | Authenticated user             | Change my password while logged in                    | I can update my credentials at any time          | Should Have |
| AUTH-10 | Authenticated user             | Update my profile (name, avatar)                      | My teammates can identify me correctly           | Should Have |

### 5.2 Organizations

| ID     | As a…                       | I want to…                                    | So that…                                                      | Priority    |
| ------ | --------------------------- | --------------------------------------------- | ------------------------------------------------------------- | ----------- |
| ORG-01 | Verified user               | Create an organization                        | I can start managing teams and projects under a single entity | Must Have   |
| ORG-02 | Organization owner          | Update my organization's name and description | The profile stays accurate                                    | Must Have   |
| ORG-03 | Organization owner          | Invite users by email to join my organization | I can bring my team onto the platform                         | Must Have   |
| ORG-04 | Invited user                | Accept or decline an organization invitation  | I control which organizations I join                          | Must Have   |
| ORG-05 | Organization owner          | Assign roles (ADMIN, MEMBER) to members       | I can delegate management responsibilities                    | Must Have   |
| ORG-06 | Organization owner or admin | Remove a member from the organization         | Former employees or contractors lose access immediately       | Must Have   |
| ORG-07 | Organization owner          | View all members and their roles              | I know who has access and at what level                       | Must Have   |
| ORG-08 | Organization owner          | Delete the organization                       | I can close it when it is no longer needed                    | Should Have |
| ORG-09 | Organization owner          | See how many seats are used vs my plan limit  | I know when I need to upgrade                                 | Must Have   |

### 5.3 Teams

| ID      | As a…              | I want to…                           | So that…                                                         | Priority    |
| ------- | ------------------ | ------------------------------------ | ---------------------------------------------------------------- | ----------- |
| TEAM-01 | Organization admin | Create a team inside my organization | I can group related members and projects                         | Must Have   |
| TEAM-02 | Team lead          | Add organization members to my team  | They can access the team's projects                              | Must Have   |
| TEAM-03 | Team lead          | Remove a member from my team         | I can manage team composition without removing them from the org | Must Have   |
| TEAM-04 | Team lead          | Update team name and description     | The team profile stays clear and accurate                        | Should Have |
| TEAM-05 | Team lead          | Delete a team                        | I can clean up inactive groups                                   | Should Have |
| TEAM-06 | Member             | View all teams I belong to           | I can navigate my workspaces easily                              | Must Have   |

### 5.4 Projects

| ID      | As a…          | I want to…                                                   | So that…                                          | Priority    |
| ------- | -------------- | ------------------------------------------------------------ | ------------------------------------------------- | ----------- |
| PROJ-01 | Team lead      | Create a project inside my team                              | I can organize work around a specific goal        | Must Have   |
| PROJ-02 | Team lead      | Assign team members to a project                             | Only relevant people have access                  | Must Have   |
| PROJ-03 | Team lead      | Update project details (name, description, status, deadline) | The project record stays accurate                 | Must Have   |
| PROJ-04 | Project member | View all projects I have access to                           | I can navigate my active work                     | Must Have   |
| PROJ-05 | Team lead      | Archive a project                                            | It becomes read-only while preserving all history | Must Have   |
| PROJ-06 | Team lead      | Delete a project permanently                                 | I can remove test or duplicate projects           | Should Have |
| PROJ-07 | Project member | See a project summary (task counts by status, overdue tasks) | I assess project health at a glance               | Should Have |

### 5.5 Tasks

| ID      | As a…          | I want to…                                                           | So that…                                                            | Priority    |
| ------- | -------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- |
| TASK-01 | Project member | Create a task inside a project                                       | I can track a unit of work                                          | Must Have   |
| TASK-02 | Project member | Assign a task to a team member                                       | Ownership and responsibility are clear                              | Must Have   |
| TASK-03 | Task assignee  | Update the status of my task                                         | My team knows where it stands                                       | Must Have   |
| TASK-04 | Project member | Set a priority on a task (LOW, MEDIUM, HIGH, URGENT)                 | The team knows what to work on first                                | Must Have   |
| TASK-05 | Project member | Set a due date on a task                                             | Deadlines are visible to all project members                        | Must Have   |
| TASK-06 | Project member | Update any field of a task I created or am assigned to               | The task record stays accurate                                      | Must Have   |
| TASK-07 | Project member | Soft-delete a task                                                   | Outdated tasks are hidden without permanent data loss               | Must Have   |
| TASK-08 | Project member | Filter tasks by status, assignee, or priority                        | I find relevant tasks quickly                                       | Must Have   |
| TASK-09 | Project member | Search tasks by keyword across title and description                 | I locate specific tasks without scrolling                           | Should Have |
| TASK-10 | Team lead      | Create subtasks under a parent task                                  | I can break large deliverables into smaller units                   | Should Have |
| TASK-11 | Project member | Add tags to a task                                                   | Tasks can be grouped or filtered by topic                           | Should Have |
| TASK-12 | Project member | View a full task detail with comments, attachments, and activity log | I have complete context without leaving the task view               | Must Have   |
| TASK-13 | Team lead      | Bulk-update the status of multiple tasks at once                     | I can move a sprint forward without editing tasks one by one        | Should Have |
| TASK-14 | Team lead      | Bulk-assign multiple tasks to a team member                          | I can delegate a batch of work in one action                        | Should Have |
| TASK-15 | Project member | View tasks grouped by status in a Kanban board format                | I see the full board layout in a single API response                | Must Have   |
| TASK-16 | Team lead      | Export a project's task list as an Excel file                        | I can share structured data with stakeholders who don't use the API | Should Have |
| TASK-17 | Project member | Watch a task to receive notifications on all its changes             | I stay informed without being the assignee or owner                 | Should Have |
| TASK-18 | Project member | Unwatch a task I am currently watching                               | I stop receiving notifications I no longer need                     | Should Have |

### 5.6 Comments & Attachments

| ID         | As a…                           | I want to…                                         | So that…                                                                       | Priority    |
| ---------- | ------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| COMMENT-01 | Project member                  | Add a comment to a task                            | I can communicate with my team in context                                      | Must Have   |
| COMMENT-02 | Comment author                  | Edit my comment                                    | I can correct mistakes after posting                                           | Must Have   |
| COMMENT-03 | Comment author or project admin | Delete a comment                                   | Outdated or inappropriate content can be removed                               | Should Have |
| COMMENT-04 | Project member                  | View all comments on a task in chronological order | I can follow the discussion thread                                             | Must Have   |
| COMMENT-05 | Project member                  | Mention a teammate using @username in a comment    | They receive a notification immediately even if they are not watching the task | Should Have |
| ATTACH-01  | Project member                  | Attach a file to a task (max 10 MB)                | I can share designs, documents, or screenshots in context                      | Must Have   |
| ATTACH-02  | Project member                  | View all attachments on a task                     | I can access all shared files from one place                                   | Must Have   |
| ATTACH-03  | File uploader or project admin  | Delete an attachment                               | Outdated files do not clutter the task                                         | Should Have |

### 5.7 Activity Log

| ID     | As a…              | I want to…                                  | So that…                                                | Priority     |
| ------ | ------------------ | ------------------------------------------- | ------------------------------------------------------- | ------------ |
| LOG-01 | Project member     | See a chronological activity log for a task | I understand the full history of every change           | Must Have    |
| LOG-02 | Team lead          | See a project-level activity feed           | I can monitor everything that happened across all tasks | Should Have  |
| LOG-03 | Organization admin | See an organization-level activity feed     | I have full visibility across all teams and projects    | Nice to Have |

### 5.8 Real-Time Collaboration

| ID    | As a…                          | I want to…                                                                   | So that…                                          | Priority    |
| ----- | ------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------- | ----------- |
| RT-01 | Project member viewing a board | See task status changes update in real time                                  | I do not need to refresh the page manually        | Must Have   |
| RT-02 | Project member viewing a task  | See new comments appear in real time                                         | Conversations feel live and immediate             | Must Have   |
| RT-03 | Project member                 | See which teammates are currently viewing the same project                   | I know who is online and active                   | Should Have |
| RT-04 | Client application             | Have WebSocket connections rejected when the JWT is invalid                  | Unauthenticated users cannot join project rooms   | Must Have   |
| RT-05 | Project member                 | See a new task appear on the board in real time when a colleague creates one | My board stays current without refreshing         | Must Have   |
| RT-06 | Project member                 | See a task disappear when it is deleted by a colleague                       | I do not interact with tasks that no longer exist | Must Have   |

### 5.9 Notifications

| ID       | As a…              | I want to…                                                                 | So that…                                             | Priority     |
| -------- | ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------- | ------------ |
| NOTIF-01 | User               | Receive an in-app notification when I am assigned to a task                | I know my new responsibilities immediately           | Must Have    |
| NOTIF-02 | Task owner         | Receive an in-app notification when someone comments on my task            | I can respond without manually checking              | Must Have    |
| NOTIF-03 | User               | Receive an in-app notification when a task I am watching changes status    | I track progress without polling                     | Should Have  |
| NOTIF-04 | User               | Receive an in-app notification when I am @mentioned in a comment           | I see the message even if I am not watching the task | Should Have  |
| NOTIF-05 | User               | View all my notifications in a paginated list                              | I can review what I may have missed                  | Must Have    |
| NOTIF-06 | User               | Mark a single notification or all notifications as read                    | I track which ones I have already seen               | Must Have    |
| NOTIF-07 | User               | See my unread notification count update in real time                       | I know at a glance when something is new             | Must Have    |
| NOTIF-08 | User               | Receive an email when I am assigned to a task                              | I am notified even when I am not logged in           | Should Have  |
| NOTIF-09 | New user           | Receive a welcome and verification email after registering                 | I know my account was created and can activate it    | Must Have    |
| NOTIF-10 | User               | Receive a password reset email when I request one                          | I can regain access without contacting support       | Must Have    |
| NOTIF-11 | Task assignee      | Receive an email reminder 24 hours before a task is due                    | I am alerted before the deadline arrives             | Should Have  |
| NOTIF-12 | Organization owner | Receive an email warning before my subscription expires or a payment fails | I have time to update my billing details             | Must Have    |
| NOTIF-13 | User               | Control which email notifications I receive                                | I avoid notification fatigue                         | Nice to Have |

### 5.10 Billing & Subscriptions

| ID      | As a…                    | I want to…                                                            | So that…                                              | Priority    |
| ------- | ------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------- | ----------- |
| BILL-01 | Organization owner       | View all available subscription plans with features and pricing       | I can choose the right tier for my team               | Must Have   |
| BILL-02 | Organization owner       | Subscribe to a paid plan via Stripe Checkout                          | My team gets access to premium features               | Must Have   |
| BILL-03 | Organization owner       | Have my plan upgraded automatically after a successful payment        | Premium features are unlocked without manual steps    | Must Have   |
| BILL-04 | Organization owner       | Receive an email alert when a payment fails                           | I can update my payment method before losing access   | Must Have   |
| BILL-05 | Organization owner       | Have my plan downgraded when I cancel my subscription                 | The plan state always reflects my actual subscription | Must Have   |
| BILL-06 | Organization owner       | View my current subscription status and next billing date             | I can manage my account and forecast costs            | Should Have |
| BILL-07 | Free plan user           | Receive a clear error with an upgrade link when I hit a feature limit | I know exactly why I am blocked and how to fix it     | Must Have   |
| BILL-08 | Business plan subscriber | Have unlimited members and access to all features                     | There are no barriers to scaling my team              | Must Have   |

### 5.11 AI Integration

| ID    | As a…          | I want to…                                                                                  | So that…                                                          | Priority     |
| ----- | -------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ |
| AI-01 | Project member | Describe a task in plain language and receive an AI-generated title, priority, and deadline | I can create tasks faster with less manual effort                 | Should Have  |
| AI-02 | Project member | See the AI response stream token by token via SSE                                           | I get progressive feedback instead of waiting for a full response | Should Have  |
| AI-03 | Project member | Apply AI suggestions to a task in one click                                                 | I do not have to copy-paste each field manually                   | Nice to Have |
| AI-04 | System         | Enforce per-user rate limits on AI endpoints                                                | API costs are controlled and no single user can abuse the quota   | Must Have    |

### 5.12 Admin Module

| ID       | As a…       | I want to…                                                         | So that…                                                     | Priority     |
| -------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ------------ |
| ADMIN-01 | Super admin | View all registered users with pagination and search               | I have complete visibility over the platform user base       | Must Have    |
| ADMIN-02 | Super admin | Ban or unban a user account                                        | I can block abusive or fraudulent users immediately          | Must Have    |
| ADMIN-03 | Super admin | View all organizations on the platform                             | I can govern multi-tenant data from a single view            | Must Have    |
| ADMIN-04 | Super admin | View the subscription plan and billing status of any organization  | I can verify billing state without accessing Stripe directly | Must Have    |
| ADMIN-05 | Super admin | View platform-wide statistics (total users, orgs, projects, tasks) | I understand platform health and growth at a glance          | Should Have  |
| ADMIN-06 | Super admin | View all failed BullMQ jobs in the dead-letter queue               | I can identify and replay failed background jobs             | Should Have  |
| ADMIN-07 | Super admin | View all active WebSocket connections                              | I can monitor real-time load on the gateway                  | Nice to Have |
| ADMIN-08 | Super admin | Export any organization's task data as Excel                       | I can produce reports for legal or support purposes          | Nice to Have |

### 5.13 Developer / API Consumer

| ID     | As a…     | I want to…                                                             | So that…                                                      | Priority    |
| ------ | --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- | ----------- |
| DEV-01 | Developer | Access interactive Swagger UI at `/api/docs`                           | I explore and test all endpoints without external tools       | Must Have   |
| DEV-02 | Developer | Connect to real-time events via Socket.IO                              | I can build a reactive front-end UI                           | Must Have   |
| DEV-03 | Developer | Receive consistent, structured error responses with a code and message | I handle errors predictably across all endpoints              | Must Have   |
| DEV-04 | Developer | Access a health-check endpoint that reports DB and Redis status        | I monitor service availability in CI and production           | Should Have |
| DEV-05 | Developer | Use paginated list endpoints with page and limit params                | I handle large datasets without performance issues            | Must Have   |
| DEV-06 | Developer | Submit an idempotency key on task creation                             | I prevent duplicate tasks from double-submit or network retry | Should Have |

---

## 6. Functional Requirements

### 6.1 Auth Module

- Email/password registration with bcrypt hashing (rounds: 12).
- Email verification on registration: unique token generated → stored in Redis with 24h TTL → verification email enqueued via BullMQ. Unverified accounts are blocked from creating organizations.
- Google OAuth 2.0 login via Passport.js (`passport-google-oauth20`); auto-creates account on first login, links to existing account if email matches.
- JWT-based sessions: short-lived access token (15min) + long-lived refresh token (7 days). Access token payload includes a unique `jti` (JWT ID) claim for blacklisting.
- Refresh token stored as a hashed value in Redis (`refresh:{userId}`, TTL: 7 days); rotated on every use, old token deleted, new token written atomically.
- Access token blacklist stored in Redis (`blacklist:{jti}`, TTL: remaining token lifetime ≤ 15min); `JwtAuthGuard` checks the blacklist on every request, enables immediate revocation on logout and user ban without waiting for token expiry.
- Password reset: unique token generated → stored in Redis (`reset:{userId}`, TTL: 1h) → reset email enqueued via BullMQ → token verified on submission → new password hashed and saved.
- Global `JwtAuthGuard` applied to all routes by default; `@Public()` decorator whitelists public endpoints. `AdminGuard` layered on top of `JwtAuthGuard` for all `/admin/*` routes.
- No token-related columns on the `User` model, all transient auth state lives in Redis, keeping the DB schema clean.

### 6.2 Organizations Module

- Any verified user can create an organization; creator is automatically assigned the `OWNER` role.
- New organizations start on the `FREE` plan.
- Invitation flow: owner triggers email invite via queue → invited user receives token link → accepts or declines via API.
- Membership roles per organization: `OWNER`, `ADMIN`, `MEMBER`, enforced by `RolesGuard`.
- Seat limit enforced by `PlanGuard`: Free (3 members), Pro (20 members), Business (unlimited).
- Removing a member cascades: removes them from all teams within the organization.
- Soft delete: org and all child entities archived; no hard delete.

### 6.3 Teams Module

- Teams scoped to one organization; only org members can be added to teams within it.
- Team creator becomes team lead by default.
- Removing a team member does not remove them from the organization.
- Soft delete: `deletedAt` set on the team; cascades to set `status: ARCHIVED` (not `deletedAt`) on all child projects, making them read-only but still visible in queries.

### 6.4 Projects Module

- Projects scoped to one team; only team members can be added to a project.
- Projects have `status`: `ACTIVE` or `ARCHIVED`.
- Projects have two distinct inactive states:
  - **Archived** (`status: ARCHIVED`): set explicitly via `PATCH /:id` with `{ status: "ARCHIVED" }`. Project remains visible in all list and detail queries but is read-only, no new tasks, comments, or attachments can be added. Reversible by a team lead setting `status` back to `ACTIVE`.
  - **Soft-deleted** (`deletedAt` set): triggered by `DELETE /:id`. Project excluded from all queries. Within 24 hours of creation a super admin can hard-delete permanently; after 24 hours the record is preserved but inaccessible without direct DB access.
- When a parent team is soft-deleted, child projects receive `status: ARCHIVED`, not `deletedAt`, so data remains accessible if the team is later restored.
- Archived projects are read-only, no new tasks can be created.
- Project summary endpoint aggregates task counts by status and overdue count from DB.

### 6.5 Tasks Module

- Tasks require: `title`. Optional: `description`, `assigneeId`, `priority`, `status`, `dueDate`, `tags`, `parentTaskId`.
- Task status lifecycle: `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE`. Enforced via state machine in `TasksService`; invalid transitions return `422 Unprocessable Entity`.
- Assigning a task triggers: activity log entry + in-app notification + email job added to BullMQ queue.
- Full-text search on `title` and `description` using PostgreSQL `to_tsvector`.
- Soft delete: `deletedAt` timestamp; recoverable by admin within 30 days.
- Subtasks: task with `parentTaskId` is a subtask; parent status auto-updates to `DONE` when all subtasks are `DONE`.
- **Bulk operations:** `PATCH /tasks/bulk` accepts `{ taskIds: string[], update: Partial<Task> }`, updates status or assignee on multiple tasks atomically inside a Prisma transaction.
- **Kanban board:** `GET /projects/:id/board` returns tasks grouped by status, `{ TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] }`, in a single query using `groupBy`.
- **Excel export:** `POST /projects/:id/export` enqueues a BullMQ job; worker generates XLSX using ExcelJS and emails the download link to the requester.
- **Idempotency:** `POST /tasks` accepts an `Idempotency-Key` header; duplicate requests within 24 hours return the cached response from Redis without creating a second task.
- **Task watchers:** users can watch any task they have project access to; watchers receive notifications on all task changes via the same notification pipeline as assignees.

### 6.6 Comments & Attachments Module

- Comments belong to a task and an author.
- Adding a comment triggers notification to: task owner + all previous commenters + all task watchers (deduped).
- **@Mentions:** comment body parsed for `@username` patterns after save; each matched user receives a `MENTIONED` notification, even if they are not watching the task.
- Only comment author can edit; author or project admin can soft-delete.
- Attachments uploaded to Cloudinary/S3 via Multer; URL, filename, file size, and uploader stored in DB.
- Max file size: 10 MB per attachment.

### 6.7 Activity Log Module

- Every domain event creates an immutable activity log entry: `entityType`, `entityId`, `action`, `actorId`, `metadata`, `createdAt`.
- Logged events: task created, status changed, assignee changed, priority changed, due date changed, comment added, attachment added, member added/removed.
- Activity feed endpoints paginated; filterable by entity type.

### 6.8 Real-Time Module (WebSocket Gateway)

- NestJS `@WebSocketGateway()` with Socket.IO adapter.
- JWT validated on WebSocket handshake (`socket.handshake.auth.token`); invalid token closes connection immediately.
- Rooms: clients join `project:{id}` on opening a project board; leave on disconnect.
- Personal room: each authenticated user joins `user:{id}` room for private notifications.
- Events emitted to project room: `task:created`, `task:updated`, `task:deleted`, `comment:added`, `user:joined`, `user:left`.
- Events emitted to user room: `notification:new`.
- Redis adapter (`@socket.io/redis-adapter`) enables horizontal scaling across multiple NestJS instances.

### 6.9 Notifications Module

- In-app notifications stored in DB: `userId`, `type`, `title`, `body`, `read`, `entityType`, `entityId`, `createdAt`.
- Triggered by: task assigned, comment added, task status changed, invitation received, @mention in comment, task watcher events.
- Delivered in real time via WebSocket event `notification:new` to `user:{id}` room.
- Unread count updated in real time via WebSocket.
- Email notifications added to BullMQ `email-queue`; processed by `EmailProcessor` using Nodemailer with Handlebars HTML templates.
- Queue retry: 3 attempts, exponential backoff. Failed jobs stored in dead-letter queue.
- **Due-date reminders:** BullMQ scheduled job runs every day at 08:00 UTC via `@nestjs/schedule` cron decorator; queries all tasks with `dueDate = tomorrow` and `status != DONE`; enqueues a reminder email per assignee.
- **Subscription expiry warning:** BullMQ scheduled job checks for subscriptions expiring within 7 days and sends a warning email to the organization owner.

### 6.10 Billing Module

- Stripe products and prices defined in Stripe dashboard: Free, Pro ($9/month), Business ($29/month).
- `POST /billing/checkout` creates a Stripe Checkout session and returns the hosted payment URL.
- Stripe webhook handler at `POST /billing/webhook`: validates signature using `STRIPE_WEBHOOK_SECRET`.
- Handled events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`.
- Idempotent handler: Stripe event ID stored in DB; duplicate events are detected and ignored.
- Plan stored on `Organization.plan`; `stripeCustomerId` and `stripeSubscriptionId` stored for management.
- `PlanGuard` applied to restricted endpoints; `@RequiresPlan(Plan.PRO)` decorator sets the minimum tier.
- Seat limit enforced at invitation time; error code `PLAN_LIMIT_REACHED` returned with upgrade URL.

### 6.11 AI Module

- Groq SDK (`groq-sdk`) used for LLM inference.
- `POST /ai/suggest`: accepts `{ description: string }`, returns `{ title, priority, estimatedDeadline }` as JSON.
- `POST /ai/suggest/stream`: SSE endpoint; accepts `{ description: string }` in the request body, streams Groq response token-by-token to the client using NestJS `@Sse()`. POST is used instead of GET to avoid exposing the description in server and proxy access logs via query string.
- Per-user rate limit: 10 AI requests per user per hour, counter stored in Redis with 1-hour TTL.
- Rate limit exceeded: `429 Too Many Requests` with `Retry-After` header.

### 6.12 Admin Module

- Protected by `AdminGuard`, only users with `systemRole: SUPER_ADMIN` can access any `/admin/*` route.
- `GET /admin/users`, paginated list of all users, searchable by name or email, shows ban status.
- `PATCH /admin/users/:id/ban` sets `bannedAt`, banned users receive `403` on all subsequent authenticated requests via a middleware check.
- `PATCH /admin/users/:id/unban` clears `bannedAt`.
- `GET /admin/organizations` paginated list of all organizations with plan and member count.
- `GET /admin/stats`, aggregated platform statistics: total users, organizations, projects, tasks, active subscriptions.
- `GET /admin/queues`, list all BullMQ queues with job counts (active, waiting, failed, completed).
- `GET /admin/queues/:name/failed`, list failed jobs in a specific queue.
- `POST /admin/queues/:name/failed/:id/retry`, manually retry a specific failed job.
- All admin actions recorded in `AuditLog` with actor, action, target entity, and timestamp.
- `POST /admin/tasks/:id/restore` restores a soft-deleted task within 30 days of deletion by setting `deletedAt = null`. Tasks older than 30 days are permanently purged by a scheduled cleanup job and cannot be recovered.

### 6.13 Caching Module

- Global Redis caching via a custom `CacheInterceptor` applied per-route with `@UseCache(ttl)` decorator.
- Cached resources and TTLs:
  - Organization plan lookup: 5 minutes (invalidated on Stripe webhook)
  - Project member list: 2 minutes (invalidated on member add/remove)
  - Task board (Kanban grouped view): 30 seconds (invalidated on any task change in the project)
  - User profile: 10 minutes (invalidated on profile update)
- Cache keys follow the pattern: `cache:{resource}:{id}` (e.g. `cache:project-board:abc123`).
- Cache invalidation is explicit, no TTL drift in critical paths, service methods call `cacheManager.del(key)` after mutations.
- **Distributed locking:** Redis `SETNX`-based lock applied before concurrent write operations (e.g. bulk task update, Stripe webhook processing) to prevent race conditions. Lock TTL: 10 seconds, auto-released after operation completes.

### 6.14 Export Module

- `POST /projects/:id/export` creates a BullMQ job with `{ projectId, requesterId, format: 'xlsx' }`.
- `ExportProcessor` fetches all project tasks (including assignee names, tags, status history) from DB.
- ExcelJS generates a styled `.xlsx` file with: task title, description, status, priority, assignee, due date, created date, tags.
- Completed file uploaded to Cloudinary; download URL emailed to requester via `EmailQueue`.
- Job status retrievable via `GET /projects/:id/export/status`, returns `pending | processing | done | failed` with download URL when done.

### 6.15 Scheduled Jobs Module

- Implemented using `@nestjs/schedule` with `@Cron()` decorators.
- **Due-date reminders** (`0 8 * * *`, daily at 08:00 UTC):
  - Query: all tasks where `dueDate = tomorrow AND status != DONE AND deletedAt IS NULL`.
  - For each task: enqueue a `due-reminder` email job to the assignee.
- **Subscription expiry warning** (`0 9 * * *`, daily at 09:00 UTC):
  - Query: all organizations where Stripe `currentPeriodEnd` is within 7 days and plan is not FREE.
  - For each org: enqueue a warning email to the organization owner.

---

## 7. Non-Functional Requirements

### 7.1 Performance

- API response time: < 200ms (p95) for standard REST endpoints under normal load.
- WebSocket event delivery: < 100ms from triggering action to client receipt.
- Redis caching applied to: user plan lookup (avoid DB query on every request), project member lists.
- Pagination mandatory on all list endpoints; default page size: 20.
- AI streaming endpoints excluded from the 200ms SLA (dependent on Groq network latency).
- PostgreSQL indexes on all high-frequency query fields: `userId`, `orgId`, `projectId`, `status`, `deletedAt`.

### 7.2 Scalability

- Stateless REST API, horizontally scalable via container replicas behind a load balancer.
- Socket.IO Redis Adapter synchronises WebSocket events across multiple NestJS instances via Redis pub/sub.
- BullMQ workers can be scaled independently from the API server.
- Prisma connection pooling configured for production.

### 7.3 Availability

- Docker health-checks configured on all services (app, postgres, redis).
- Graceful shutdown: NestJS `enableShutdownHooks()` drains in-flight requests on SIGTERM.
- BullMQ jobs persisted in Redis, survive application restarts without job loss.

### 7.4 Security

- HTTPS enforced in production via Nginx/Railway reverse proxy.
- Helmet.js for HTTP security headers (XSS protection, HSTS, no-sniff, referrer-policy).
- CORS configured with an explicit origin allowlist; credentials mode enabled.
- Global rate limiting: 100 requests / minute per IP; auth endpoints limited to 10 requests / minute.
- All request bodies validated via `class-validator` + `class-transformer` global `ValidationPipe`.
- SQL injection prevention: all queries through Prisma parameterised client; no raw string interpolation.
- JWT secrets and Stripe keys stored in environment variables, never in source code.
- Passwords never logged or returned in any API response.
- Stripe webhook signature verified on every incoming event using `stripe.webhooks.constructEvent()`.

### 7.5 Maintainability

- TypeScript strict mode enabled across the entire codebase.
- Conventional Commits enforced via `commitlint` + Husky pre-commit hooks.
- ESLint + Prettier for consistent code style, violations block commits.
- NestJS module system enforces separation of concerns, one feature = one module.
- DTOs defined with `class-validator` decorators, validation and documentation in one place.
- No magic strings, enums defined for `TaskStatus`, `Priority`, `Plan`, `Role`, `NotificationType`.
- Centralised `AppConfigModule` wrapping `@nestjs/config` with a Joi validation schema, validates all required environment variables at startup and crashes with a clear error if any are missing, preventing silent runtime failures in production.
- Swagger generated entirely from `@ApiProperty()`, `@ApiOperation()`, and `@ApiResponse()` decorators, no manual YAML.

### 7.6 Observability

- Structured JSON logging via pino: `level`, `timestamp`, `requestId`, `userId`, `method`, `path`, `statusCode`, `durationMs`.
- Request ID injected into every log entry via interceptor for end-to-end traceability.
- Sensitive fields (passwords, tokens, credit card data) never logged.
- Health check endpoint: `GET /health` reports DB connectivity and Redis connectivity via `@nestjs/terminus`.
- Application version tracked in `package.json` and exposed in health check response.

---

## 8. System Architecture

### 8.1 High-Level Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│                          Clients                                  │
│    Web App  ·  Mobile App  ·  Swagger UI  ·  API Consumers       │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTP / WebSocket / SSE
┌───────────────────────────────▼──────────────────────────────────┐
│                      Nginx Reverse Proxy                          │
│          SSL Termination  ·  Load Balancing  ·  Gzip             │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                    NestJS Application Server                       │
│                                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │   REST API       │  │  WebSocket GW    │  │   SSE (AI)      │  │
│  │  /api/v1/*      │  │  Socket.IO       │  │  /ai/stream     │  │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬────────┘  │
│           │                    │                       │           │
│  ┌────────▼────────────────────▼───────────────────────▼────────┐ │
│  │              Global Middleware Pipeline                        │ │
│  │  JwtAuthGuard · RolesGuard · PlanGuard · ValidationPipe      │ │
│  │  RateLimiter  · Helmet    · CORS      · LoggingInterceptor   │ │
│  └──────────────────────────────┬─────────────────────────────── ┘ │
│                                 │                                   │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │   Feature Modules (NestJS DI)                                 │  │
│  │   Auth · Users · Orgs · Teams · Projects · Tasks             │  │
│  │   Comments · Notifications · Billing · AI · Activity         │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                   │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │                    Prisma ORM Client                           │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────── ┼───────────────────────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────────┐
           │                      │                           │
  ┌────────▼────────┐  ┌──────────▼────────┐  ┌─────────────▼──────┐
  │   PostgreSQL     │  │   Redis            │  │   Cloudinary / S3  │
  │   (Primary DB)   │  │   Cache + Pub/Sub  │  │   File Storage     │
  │   Prisma Migrate │  │   BullMQ + WS Adp  │  │   Avatars + Files  │
  └─────────────────┘  └───────────────────┘  └────────────────────┘
                                  │
                       ┌──────────▼──────────────────┐
                       │   BullMQ Workers              │
                       │   · EmailProcessor            │
                       │     (Nodemailer + queue)      │
                       └─────────────────────────────-─┘
                                  │
                       ┌──────────▼──────────────────┐
                       │   External Services           │
                       │   · Stripe (billing)          │
                       │   · Groq API (AI)             │
                       │   · Google OAuth              │
                       └──────────────────────────────┘
```

### 8.2 NestJS Module Map

```text
AppModule
├── ConfigModule          (global env validation via Joi)
├── PrismaModule          (global DB client)
├── RedisModule           (global Redis client, ioredis)
├── CacheModule           (custom CacheInterceptor + @UseCache decorator)
├── SchedulerModule       (@nestjs/schedule, cron jobs)
├── AuthModule
│   ├── JwtModule
│   └── PassportModule    (JWT + Google strategies)
├── UsersModule
├── OrganizationsModule
├── TeamsModule
├── ProjectsModule
├── TasksModule
│   └── TaskWatchersModule
├── CommentsModule        (includes @mention parsing)
├── AttachmentsModule
├── ExportModule          (ExcelJS + BullMQ ExportQueue)
├── ActivityModule
├── NotificationsModule
├── GatewayModule         (WebSocket, TasksGateway)
├── BillingModule         (Stripe)
├── AiModule              (Groq + SSE)
├── QueueModule           (BullMQ, EmailQueue + ExportQueue + processors)
├── AdminModule           (super-admin routes + AuditLog)
└── HealthModule          (@nestjs/terminus)
```

### 8.3 Design Patterns Applied

| Pattern                 | Usage                                                                                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module Pattern          | NestJS modules, each feature is self-contained with its own controller, service, and repository                                                                                        |
| Repository Pattern      | Thin Prisma wrapper in each service, DB logic isolated from business logic                                                                                                             |
| Dependency Injection    | NestJS IoC container wires all providers, fully testable with mock injection                                                                                                           |
| Guard Pattern           | `JwtAuthGuard`, `RolesGuard`, `PlanGuard`, `AdminGuard`, composable, declarative authorization                                                                                         |
| Interceptor Pattern     | `LoggingInterceptor` (request tracing), `TransformInterceptor` (consistent response envelope), `CacheInterceptor` (Redis caching), `IdempotencyInterceptor` (double-submit prevention) |
| Pipe Pattern            | Global `ValidationPipe`, validates and transforms DTOs before they reach controllers                                                                                                   |
| Custom Decorators       | `@CurrentUser()` extracts JWT user; `@Public()` whitelists routes; `@Roles()` sets required roles; `@RequiresPlan()` sets minimum plan; `@UseCache(ttl)` enables route-level caching   |
| Observer / Event        | Socket.IO gateway emits domain events to project and user rooms                                                                                                                        |
| Queue / Worker          | BullMQ separates email delivery, Excel export, and scheduled reminders from the API request lifecycle                                                                                  |
| Strategy Pattern        | Passport.js strategies for JWT and Google OAuth                                                                                                                                        |
| State Machine           | Task status transitions enforced in `TasksService`, invalid transitions return `422`                                                                                                   |
| Distributed Locking     | Redis `SETNX`-based lock prevents race conditions on concurrent bulk writes and Stripe webhook processing                                                                              |
| Response Transformation | `ClassSerializerInterceptor` + `@Exclude()` on sensitive Prisma fields, passwords and tokens never leak into responses                                                                 |
| Idempotency             | `Idempotency-Key` header on `POST /tasks`, response cached in Redis for 24h, duplicates return `200` with cached response                                                              |

### 8.4 Route Structure

```text
/api/v1/auth/                → Authentication (register, login, OAuth, refresh, logout)
/api/v1/users/               → User profile management
/api/v1/organizations/       → Organization CRUD and member management
/api/v1/teams/               → Team CRUD and membership
/api/v1/projects/            → Project CRUD, members, summary, board, export
/api/v1/tasks/               → Task CRUD, search, subtasks, tags, bulk ops, watchers
/api/v1/comments/            → Comment CRUD + @mention parsing
/api/v1/attachments/         → File attachments on tasks
/api/v1/activity/            → Activity log per task, project, or org
/api/v1/notifications/       → In-app notification list and mark-as-read
/api/v1/billing/             → Stripe plans, checkout, subscription status
/api/v1/billing/webhook      → Stripe webhook receiver (no JWT auth, signature verified)
/api/v1/ai/suggest           → AI task suggestion (JSON response)
/api/v1/ai/suggest/stream    → AI task suggestion (SSE stream)
/api/v1/admin/               → Super-admin: users, orgs, stats, queues, audit log
/health                      → Health check (DB + Redis status)
/api/docs                    → Swagger UI
```

---

## 9. Data Models & ERD

### 9.1 Entities (Prisma Schema)

#### User

```prisma
model User {
  id               String      @id @default(uuid())
  email            String      @unique
  password         String?                        // null for OAuth users
  name             String
  avatarUrl        String?
  isEmailVerified  Boolean     @default(false)   // flag stays in DB
  googleId         String?     @unique
  systemRole       SystemRole  @default(USER)
  bannedAt         DateTime?                      // null = active
  notifPreferences Json        @default("{}")
  stripeCustomerId String?     @unique
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  memberships        OrgMember[]
  teamMemberships    TeamMember[]
  projectMemberships ProjectMember[]
  assignedTasks      Task[]          @relation("Assignee")
  createdTasks       Task[]          @relation("Creator")
  comments           Comment[]
  attachments        Attachment[]
  activityLogs       ActivityLog[]   @relation("Actor")
  notifications      Notification[]
  taskWatchers       TaskWatcher[]
  auditLogs          AuditLog[]
}

enum SystemRole { USER  SUPER_ADMIN }
```

#### Organization

```prisma
model Organization {
  id                    String    @id @default(uuid())
  name                  String
  description           String?
  plan                  Plan      @default(FREE)
  stripeCustomerId      String?   @unique
  stripeSubscriptionId  String?   @unique
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?                        // soft delete

  members               OrgMember[]
  teams                 Team[]
  activityLogs          ActivityLog[]
}

model OrgMember {
  id             String    @id @default(uuid())
  userId         String
  orgId          String
  role           OrgRole   @default(MEMBER)
  joinedAt       DateTime  @default(now())

  user           User         @relation(fields: [userId], references: [id])
  org            Organization @relation(fields: [orgId], references: [id])

  @@unique([userId, orgId])
}

enum OrgRole { OWNER  ADMIN  MEMBER }
enum Plan   { FREE   PRO    BUSINESS }
```

#### Team

```prisma
model Team {
  id          String    @id @default(uuid())
  name        String
  description String?
  orgId       String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  org         Organization @relation(fields: [orgId], references: [id])
  members     TeamMember[]
  projects    Project[]
}

model TeamMember {
  id      String @id @default(uuid())
  userId  String
  teamId  String
  role    TeamRole @default(MEMBER)

  user    User   @relation(fields: [userId], references: [id])
  team    Team   @relation(fields: [teamId], references: [id])

  @@unique([userId, teamId])
}
```

#### Project

```prisma
model Project {
  id          String        @id @default(uuid())
  name        String
  description String?
  status      ProjectStatus @default(ACTIVE)
  deadline    DateTime?
  teamId      String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  deletedAt   DateTime?

  team        Team            @relation(fields: [teamId], references: [id])
  members     ProjectMember[]
  tasks       Task[]
  activityLogs ActivityLog[]
}

model ProjectMember {
  id        String  @id @default(uuid())
  userId    String
  projectId String

  user      User    @relation(fields: [userId], references: [id])
  project   Project @relation(fields: [projectId], references: [id])

  @@unique([userId, projectId])
}

enum ProjectStatus { ACTIVE  ARCHIVED }
```

#### Task

```prisma
model Task {
  id           String      @id @default(uuid())
  title        String
  description  String?
  status       TaskStatus  @default(TODO)
  priority     Priority    @default(MEDIUM)
  dueDate      DateTime?
  tags         String[]
  projectId    String
  assigneeId   String?
  creatorId    String
  parentTaskId String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  deletedAt    DateTime?

  project      Project     @relation(fields: [projectId], references: [id])
  assignee     User?       @relation("Assignee", fields: [assigneeId], references: [id])
  creator      User        @relation("Creator", fields: [creatorId], references: [id])
  parent       Task?       @relation("Subtasks", fields: [parentTaskId], references: [id])
  subtasks     Task[]      @relation("Subtasks")
  comments     Comment[]
  watchers     TaskWatcher[]
  attachments  Attachment[]
  activityLogs ActivityLog[]
}

enum TaskStatus { TODO  IN_PROGRESS  IN_REVIEW  DONE }
enum Priority  { LOW   MEDIUM       HIGH       URGENT }
```

#### Comment, Attachment, ActivityLog, Notification

```prisma
model Comment {
  id        String    @id @default(uuid())
  body      String
  taskId    String
  authorId  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  task      Task      @relation(fields: [taskId], references: [id])
  author    User      @relation(fields: [authorId], references: [id])
}

model Attachment {
  id         String   @id @default(uuid())
  filename   String
  url        String
  size       Int                              // bytes
  taskId     String
  uploaderId String
  createdAt  DateTime @default(now())

  task       Task     @relation(fields: [taskId], references: [id])
  uploader   User     @relation(fields: [uploaderId], references: [id])
}

model ActivityLog {
  id           String   @id @default(uuid())
  action       String                         // e.g. "task.status.changed"
  entityType   String                         // "Task" | "Project" | "Org"
  entityId     String
  actorId      String
  metadata     Json     @default("{}")        // { from, to, field }
  projectId    String?
  orgId        String?
  createdAt    DateTime @default(now())

  actor        User         @relation("Actor", fields: [actorId], references: [id])
  project      Project?     @relation(fields: [projectId], references: [id])
  org          Organization? @relation(fields: [orgId], references: [id])
}

model TaskWatcher {
  id        String   @id @default(uuid())
  userId    String
  taskId    String
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  task      Task     @relation(fields: [taskId], references: [id])

  @@unique([userId, taskId])
}

model AuditLog {
  id         String   @id @default(uuid())
  actorId    String
  action     String                         // e.g. "admin.user.banned"
  targetType String                         // "User" | "Organization" | "Queue"
  targetId   String?
  metadata   Json     @default("{}")
  createdAt  DateTime @default(now())

  actor      User     @relation(fields: [actorId], references: [id])
}

model StripeEvent {
  id          String   @id                  // Stripe event ID (evt_xxx)
  type        String
  processedAt DateTime @default(now())
  // Used for idempotency, duplicate events are detected by PK conflict
}
```

#### Notification

```prisma
model Notification {
  id         String   @id @default(uuid())
  userId     String
  type       String
  title      String
  body       String
  isRead     Boolean  @default(false)
  entityType String
  entityId   String
  createdAt  DateTime @default(now())

  user       User     @relation(fields: [userId], references: [id])
}
```

### 9.2 Key Relationships

```text
User ──(joins many)──► Organization   via OrgMember   (userId, orgId, role)
User ──(joins many)──► Team           via TeamMember   (userId, teamId)
User ──(joins many)──► Project        via ProjectMember(userId, projectId)
Organization ──(has many)──► Team
Team ──(has many)──► Project
Project ──(has many)──► Task
Task ──(has many)──► Comment
Task ──(has many)──► Attachment
Task ──(has many)──► ActivityLog
Task ──(parent of many)──► Task       (subtasks via parentTaskId)
User ──(receives many)──► Notification
```

### 9.3 Cascade & Deletion Rules

| Deleted Entity | Behavior                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Organization   | Soft delete; all teams, projects, tasks archived; members lose access                                                                                                                                                          |
| Team           | `deletedAt` set; child projects have `status` set to `ARCHIVED` (not soft-deleted); team members remain in the org                                                                                                             |
| Project        | `DELETE /:id` sets `deletedAt`, excluded from all queries. `PATCH /:id { status: "ARCHIVED" }` makes it read-only without hiding it. Team cascade sets `status: ARCHIVED`. Super admin can hard-delete within 24h of creation. |
| Task           | Soft delete; `deletedAt` set; recoverable within 30 days by admin                                                                                                                                                              |
| User           | Account deactivated; tasks remain; reassignment required by admin                                                                                                                                                              |
| Comment        | Soft delete; body replaced with `[deleted]`                                                                                                                                                                                    |

---

## 10. API Design

### 10.1 REST Endpoints

#### Auth (`/api/v1/auth`)

| Method | Path               | Description                                | Auth        |
| ------ | ------------------ | ------------------------------------------ | ----------- |
| POST   | `/register`        | Register with email + password             | None        |
| POST   | `/login`           | Login, receive JWT access + refresh tokens | None        |
| GET    | `/google`          | Initiate Google OAuth flow                 | None        |
| GET    | `/google/callback` | Google OAuth callback                      | None        |
| POST   | `/verify-email`    | Verify email with token                    | None        |
| POST   | `/forgot-password` | Request password reset email               | None        |
| POST   | `/reset-password`  | Reset password with token                  | None        |
| POST   | `/refresh`         | Rotate refresh token, get new access token | Refresh JWT |
| POST   | `/logout`          | Invalidate refresh token                   | Access JWT  |

#### Users (`/api/v1/users`)

| Method | Path           | Description            | Auth |
| ------ | -------------- | ---------------------- | ---- |
| GET    | `/me`          | Get own profile        | User |
| PATCH  | `/me`          | Update name or avatar  | User |
| PATCH  | `/me/password` | Change password        | User |
| DELETE | `/me`          | Deactivate own account | User |

#### Organizations (`/api/v1/organizations`)

| Method | Path                              | Description                    | Auth        |
| ------ | --------------------------------- | ------------------------------ | ----------- |
| POST   | `/`                               | Create organization            | User        |
| GET    | `/`                               | List organizations I belong to | User        |
| GET    | `/:id`                            | Get organization details       | Member      |
| PATCH  | `/:id`                            | Update organization            | Owner/Admin |
| DELETE | `/:id`                            | Soft-delete organization       | Owner       |
| POST   | `/:id/invite`                     | Invite user by email           | Owner/Admin |
| POST   | `/:id/invitations/:token/accept`  | Accept invitation              | None        |
| POST   | `/:id/invitations/:token/decline` | Decline invitation             | None        |
| GET    | `/:id/members`                    | List members                   | Member      |
| PATCH  | `/:id/members/:userId/role`       | Change member role             | Owner/Admin |
| DELETE | `/:id/members/:userId`            | Remove member                  | Owner/Admin |

#### Teams (`/api/v1/teams`)

| Method | Path                   | Description               | Auth       |
| ------ | ---------------------- | ------------------------- | ---------- |
| POST   | `/`                    | Create team inside an org | Admin      |
| GET    | `/mine`                | List teams I belong to    | User       |
| GET    | `/:id`                 | Get team details          | Member     |
| PATCH  | `/:id`                 | Update team               | Lead       |
| DELETE | `/:id`                 | Soft-delete team          | Lead/Admin |
| POST   | `/:id/members`         | Add member to team        | Lead       |
| DELETE | `/:id/members/:userId` | Remove member from team   | Lead       |

#### Projects (`/api/v1/projects`)

| Method | Path                   | Description                            | Auth   |
| ------ | ---------------------- | -------------------------------------- | ------ |
| POST   | `/`                    | Create project inside a team           | Lead   |
| GET    | `/mine`                | List projects I have access to         | User   |
| GET    | `/:id`                 | Get project details                    | Member |
| PATCH  | `/:id`                 | Update project                         | Lead   |
| DELETE | `/:id`                 | Archive or delete project              | Lead   |
| GET    | `/:id/summary`         | Get task count summary                 | Member |
| GET    | `/:id/board`           | Get tasks grouped by status (Kanban)   | Member |
| POST   | `/:id/export`          | Enqueue Excel export job               | Lead   |
| GET    | `/:id/export/status`   | Check export job status + download URL | Lead   |
| POST   | `/:id/members`         | Add member to project                  | Lead   |
| DELETE | `/:id/members/:userId` | Remove member from project             | Lead   |
| GET    | `/:id/activity`        | Project activity feed                  | Member |

#### Tasks (`/api/v1/tasks`)

| Method | Path            | Description                                      | Auth   |
| ------ | --------------- | ------------------------------------------------ | ------ |
| POST   | `/`             | Create task (supports Idempotency-Key header)    | Member |
| GET    | `/`             | List tasks with filters                          | Member |
| GET    | `/:id`          | Get task details                                 | Member |
| PATCH  | `/:id`          | Update task                                      | Member |
| DELETE | `/:id`          | Soft-delete task                                 | Member |
| PATCH  | `/bulk`         | Bulk-update status or assignee on multiple tasks | Lead   |
| GET    | `/:id/activity` | Task activity log                                | Member |
| POST   | `/:id/watch`    | Watch a task                                     | Member |
| DELETE | `/:id/watch`    | Unwatch a task                                   | Member |
| GET    | `/:id/watchers` | List task watchers                               | Member |

#### Comments (`/api/v1/comments`)

| Method | Path            | Description                              | Auth         |
| ------ | --------------- | ---------------------------------------- | ------------ |
| POST   | `/`             | Add comment to a task (parses @mentions) | Member       |
| GET    | `/task/:taskId` | Get all comments for task                | Member       |
| PATCH  | `/:id`          | Edit comment                             | Author       |
| DELETE | `/:id`          | Soft-delete comment                      | Author/Admin |

#### Attachments (`/api/v1/attachments`)

| Method | Path            | Description                    | Auth           |
| ------ | --------------- | ------------------------------ | -------------- |
| POST   | `/task/:taskId` | Upload attachment to task      | Member         |
| GET    | `/task/:taskId` | List all attachments on a task | Member         |
| DELETE | `/:id`          | Delete an attachment           | Uploader/Admin |

#### Notifications (`/api/v1/notifications`)

| Method | Path            | Description                      | Auth |
| ------ | --------------- | -------------------------------- | ---- |
| GET    | `/`             | Get my notifications (paginated) | User |
| GET    | `/unread-count` | Get unread count                 | User |
| PATCH  | `/:id/read`     | Mark one as read                 | User |
| PATCH  | `/read-all`     | Mark all as read                 | User |

#### Billing (`/api/v1/billing`)

| Method | Path            | Description                      | Auth       |
| ------ | --------------- | -------------------------------- | ---------- |
| GET    | `/plans`        | List available plans             | None       |
| POST   | `/checkout`     | Create Stripe Checkout session   | Owner      |
| GET    | `/subscription` | Get current subscription details | Owner      |
| POST   | `/webhook`      | Stripe webhook receiver          | Stripe Sig |

#### AI (`/api/v1/ai`)

| Method | Path              | Description                    | Auth |
| ------ | ----------------- | ------------------------------ | ---- |
| POST   | `/suggest`        | Get AI task suggestions (JSON) | User |
| POST   | `/suggest/stream` | Stream AI suggestions via SSE  | User |

#### Admin (`/api/v1/admin`)

| Method | Path                             | Description                                  | Auth        |
| ------ | -------------------------------- | -------------------------------------------- | ----------- |
| GET    | `/users`                         | List all users (paginated + searchable)      | Super Admin |
| PATCH  | `/users/:id/ban`                 | Ban a user                                   | Super Admin |
| PATCH  | `/users/:id/unban`               | Unban a user                                 | Super Admin |
| GET    | `/organizations`                 | List all organizations with plan info        | Super Admin |
| GET    | `/stats`                         | Platform-wide statistics                     | Super Admin |
| GET    | `/queues`                        | List all BullMQ queues with job counts       | Super Admin |
| GET    | `/queues/:name/failed`           | List failed jobs in a queue                  | Super Admin |
| POST   | `/queues/:name/failed/:id/retry` | Retry a specific failed job                  | Super Admin |
| GET    | `/audit`                         | Paginated audit log of all admin actions     | Super Admin |
| POST   | `/tasks/:id/restore`             | Restore a soft-deleted task (within 30 days) | Super Admin |

#### Health

| Method | Path      | Description                   | Auth |
| ------ | --------- | ----------------------------- | ---- |
| GET    | `/health` | Check DB + Redis connectivity | None |

### 10.2 WebSocket Events (Socket.IO)

| Event              | Direction | Payload                 | Description                      |
| ------------------ | --------- | ----------------------- | -------------------------------- |
| `connection`       | C→S       | `{ token: string }`     | Authenticate socket on handshake |
| `join:project`     | C→S       | `{ projectId: string }` | Join a project room              |
| `leave:project`    | C→S       | `{ projectId: string }` | Leave a project room             |
| `task:created`     | S→C       | `{ task }`              | New task created in project      |
| `task:updated`     | S→C       | `{ taskId, changes }`   | Task fields updated              |
| `task:deleted`     | S→C       | `{ taskId }`            | Task soft-deleted                |
| `comment:added`    | S→C       | `{ comment }`           | New comment on a task            |
| `user:joined`      | S→C       | `{ userId, name }`      | User joined the project view     |
| `user:left`        | S→C       | `{ userId }`            | User left the project view       |
| `notification:new` | S→C       | `{ notification }`      | New in-app notification          |

### 10.3 Response Envelope

All REST responses follow a consistent envelope:

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": { ... }
}
```

Paginated list response:

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

Error response:

```json
{
  "success": false,
  "statusCode": 403,
  "error": "PLAN_LIMIT_REACHED",
  "message": "Free plan allows up to 3 members. Upgrade to Pro to add more.",
  "upgradeUrl": "http://localhost:3000/billing", // dev
  "timestamp": "2026-06-01T10:00:00Z",
  "path": "/api/v1/organizations/abc/invite"
}
```

---

## 11. Security Requirements

| Requirement        | Implementation                                                               |
| ------------------ | ---------------------------------------------------------------------------- |
| Password Storage   | bcrypt with 12 salt rounds                                                   |
| Transport Security | HTTPS enforced in production via Nginx + Railway                             |
| HTTP Headers       | Helmet.js (XSS, HSTS, no-sniff, referrer-policy, CSP)                        |
| API Rate Limiting  | Global: 100 req/min per IP; Auth endpoints: 10 req/min per IP                |
| AI Rate Limiting   | 10 AI requests per user per hour via Redis counter with TTL                  |
| Authentication     | JWT access token (15min) + refresh token (7 days, rotated)                   |
| Token Storage      | Refresh token stored as bcrypt hash in Redis; raw value never stored         |
| Authorisation      | `RolesGuard` (org/team roles) + `PlanGuard` (subscription tier)              |
| Input Validation   | Global `ValidationPipe` with `class-validator` on all DTOs                   |
| SQL Injection      | All queries via Prisma parameterised client; no raw string queries           |
| WebSocket Auth     | JWT validated on handshake; invalid token immediately closes connection      |
| Stripe Security    | Webhook signature verified via `stripe.webhooks.constructEvent()`            |
| File Upload        | Multer file type + size validation (max 10MB); Cloudinary signed URLs        |
| Secrets Management | All secrets in `.env`; `.env.example` committed with placeholder values      |
| Logging            | Passwords, tokens, and card data never logged; Pino `redact` config applied  |
| CORS               | Explicit origin allowlist; credentials mode controlled                       |
| Idempotency        | Stripe event IDs stored in DB; duplicate webhook events detected and skipped |

---

## 12. Infrastructure & DevOps

### 12.1 Technology Stack

| Layer                | Technology                                              |
| -------------------- | ------------------------------------------------------- |
| Runtime              | Node.js                                                 |
| Framework            | NestJS                                                  |
| Database             | PostgreSQL                                              |
| ORM                  | Prisma                                                  |
| Cache / Queue Broker | Redis                                                   |
| Background Jobs      | BullMQ + @nestjs/bullmq                                 |
| Scheduled Jobs       | @nestjs/schedule (cron-based reminders + cleanup)       |
| Real-time            | Socket.IO + @socket.io/redis-adapter                    |
| File Storage         | Cloudinary (or AWS S3)                                  |
| Email                | Nodemailer + Handlebars HTML templates                  |
| Excel Export         | ExcelJS                                                 |
| Auth                 | @nestjs/passport, passport-jwt, passport-google-oauth20 |
| Payments             | stripe                                                  |
| AI                   | groq-sdk                                                |
| Validation           | class-validator, class-transformer                      |
| API Docs             | @nestjs/swagger                                         |
| Logging              | pino, pino-http                                         |
| Health               | @nestjs/terminus                                        |
| Testing              | Jest, SuperTest, @nestjs/testing                        |
| Containerisation     | Docker + Docker Compose                                 |
| Reverse Proxy        | Nginx                                                   |
| CI/CD                | GitHub Actions                                          |
| Deployment           | Railway                                                 |

### 12.2 Docker Configuration

```bash
# Start development environment (hot-reload, debug ports)
docker compose -p velo-dev \
  -f docker-compose.yml -f docker-compose.dev.yml \
  up --build -d

# Start test environment (isolated test DB)
docker compose -p velo-test \
  -f docker-compose.yml -f docker-compose.test.yml \
  up --build -d

# Start production environment (multi-stage build, resource limits)
docker compose -p velo-prod \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up --build -d
```

- `docker-compose.yml`: base services: app, postgres, redis
- `docker-compose.dev.yml`: volume mounts, nodemon/tsx, debug port 9229
- `docker-compose.test.yml`: isolated postgres on port 5433, test env vars
- `docker-compose.prod.yml`: multi-stage Dockerfile, resource limits, health-checks, restart policies

### 12.3 CI/CD Pipeline (GitHub Actions)

Triggered on: push or pull request to `dev` or `main`.

```text
┌──────────────┐
│  Setup Job   │  → Checkout, install deps (node_modules cache)
└──────┬───────┘
       │ (parallel)
┌──────┴──────────────────────────────────────────────────────────────┐
│  Lint (ESLint)  │  Format (Prettier)  │  Type Check (tsc --noEmit)  │
└─────────────────────────────────────────────────────────────────────┘
       │ (after all checks pass)
┌──────▼──────────────────────────────────────────────┐
│  Unit Tests (Jest)                                  │
│  Integration / E2E Tests (SuperTest + test DB)      │
│  Coverage Report (uploaded as artifact)             │
└─────────────────────────────────────────────────────┘
       │ (on push to main only)
┌──────▼──────────────┐
│  Build Docker Image │  → Push to Docker Hub
│  Deploy to Railway  │
└─────────────────────┘
```

- Action SHAs pinned for security (no floating `@main` tags).
- Minimal permissions per job (principle of least privilege).
- Secrets injected via GitHub repository secrets, never in YAML files.

### 12.4 Environment Variables

| Variable                   | Purpose                                                 |
| -------------------------- | ------------------------------------------------------- |
| `PORT`                     | HTTP server port (default: 3000)                        |
| `NODE_ENV`                 | Environment mode: `development` / `test` / `production` |
| `DATABASE_URL`             | PostgreSQL connection string (neon)                     |
| `REDIS_URL`                | Redis connection URI (BullMQ + Socket.IO adapter)       |
| `JWT_ACCESS_SECRET`        | JWT access token signing secret                         |
| `JWT_REFRESH_SECRET`       | JWT refresh token signing secret                        |
| `JWT_ACCESS_EXPIRES_IN`    | Access token TTL (e.g. `15m`)                           |
| `JWT_REFRESH_EXPIRES_IN`   | Refresh token TTL (e.g. `7d`)                           |
| `GOOGLE_CLIENT_ID`         | Google OAuth client ID                                  |
| `GOOGLE_CLIENT_SECRET`     | Google OAuth client secret                              |
| `GOOGLE_CALLBACK_URL`      | Google OAuth redirect URI                               |
| `SMTP_HOST`                | Nodemailer SMTP host                                    |
| `SMTP_PORT`                | Nodemailer SMTP port                                    |
| `SMTP_USER`                | Nodemailer SMTP user                                    |
| `SMTP_PASS`                | Nodemailer SMTP password                                |
| `EMAIL_FROM`               | Sender address for all outgoing emails                  |
| `CLOUDINARY_NAME`          | Cloudinary cloud name                                   |
| `CLOUDINARY_KEY`           | Cloudinary API key                                      |
| `CLOUDINARY_SECRET`        | Cloudinary API secret                                   |
| `STRIPE_SECRET_KEY`        | Stripe secret API key                                   |
| `STRIPE_WEBHOOK_SECRET`    | Stripe webhook endpoint secret                          |
| `STRIPE_PRO_PRICE_ID`      | Stripe Price ID for Pro plan                            |
| `STRIPE_BUSINESS_PRICE_ID` | Stripe Price ID for Business plan                       |
| `GROQ_API_KEY`             | Groq API key for AI inference                           |
| `CLIENT_URL`               | Frontend base URL (for CORS + email links)              |

---

## 13. Testing Strategy

### 13.1 Test Types

| Type              | Framework              | Scope                                                                                        |
| ----------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| Unit Tests        | Jest + @nestjs/testing | Services and guards in isolation, Prisma and Redis mocked via `jest.mock()`                  |
| Integration Tests | Jest + SuperTest       | Full HTTP request/response cycle against a real test PostgreSQL DB (docker-compose.test.yml) |
| E2E Tests         | Jest + SuperTest       | Complete user flows: register → create org → invite member → create task → update status     |

### 13.2 Test Scripts

```bash
pnpm run test        # Run all unit tests
pnpm run test:e2e    # Run all e2e tests (requires docker-compose.test.yml)
pnpm run test:cov    # Coverage report
pnpm run test:watch  # Watch mode for unit tests during development
```

### 13.3 Key Coverage Areas

- **Auth flows:** register, verify email, login, refresh, logout, Google OAuth, password reset
- **Authorization:** role-based guards (OWNER/ADMIN/MEMBER), plan guards (FREE/PRO/BUSINESS)
- **Task state machine:** valid and invalid status transitions
- **Billing:** Stripe webhook handling for all subscription lifecycle events; idempotency check
- **Queue:** BullMQ job creation on task assignment; retry behavior on processor failure
- **WebSocket:** JWT validation on handshake; room join/leave; event broadcast on task update
- **Pagination:** all list endpoints return correct `meta` object and respect `page`/`limit` params
- **Soft delete:** deleted records excluded from all list queries; recoverable by admin
- **Rate limiting:** AI endpoints return 429 after quota exceeded

### 13.4 Pre-commit Quality Gates (Husky)

1. ESLint with auto-fix (`--fix` flag)
2. Prettier formatting check
3. Commitlint conventional commit validation
4. TypeScript type check (`tsc --noEmit`)

---

## 14. Future Roadmap

### Near-Term (v2.x)

| Feature                  | Description                                                               | Priority |
| ------------------------ | ------------------------------------------------------------------------- | -------- |
| Task Time Tracking       | Start/stop timer on a task; log hours spent; display total on task detail | High     |
| Project Analytics        | Burndown chart data, cycle time, and team velocity metrics per project    | High     |
| Notification Preferences | Fine-grained per-user toggle for each `NotificationType`                  | Medium   |
| Activity Log CSV Export  | Organization admins export full audit trail as a downloadable CSV         | Medium   |

### Mid-Term (v3.x)

| Feature                   | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| Two-Factor Authentication | TOTP-based 2FA (Google Authenticator compatible)                   |
| Custom Task Fields        | Teams define extra fields on tasks (text, number, dropdown)        |
| Mobile Push Notifications | Firebase Cloud Messaging for mobile clients                        |
| Third-Party Integrations  | GitHub PR linking, Slack notifications, external webhook support   |
| API Keys                  | Machine-to-machine access without user JWT, for CI/CD integrations |

### Long-Term

| Feature                         | Description                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------- |
| AI Sprint Planner               | AI suggests task groupings and sprint schedule based on deadlines and priorities |
| Multi-language Support          | i18n for API error messages and email templates                                  |
| White-label / Multi-tenant SaaS | Custom domains per organization; enterprise billing tiers                        |
| GraphQL API                     | Alternative query interface for flexible data fetching                           |

---

## 15. Success Metrics

### Technical KPIs

| Metric                         | Target                   |
| ------------------------------ | ------------------------ |
| API p95 response time          | < 200ms                  |
| WebSocket event latency        | < 100ms                  |
| Uptime                         | ≥ 99% on Railway         |
| Test coverage (overall)        | ≥ 60%                    |
| Test coverage (auth + billing) | ≥ 80%                    |
| CI pass rate on `main`         | ≥ 95%                    |
| Stripe webhook idempotency     | 0 duplicate plan changes |
| BullMQ job success rate        | ≥ 98% (after retries)    |

### Product KPIs (Post-Launch)

| Metric                 | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| Registered Users       | Total verified accounts created                             |
| Active Organizations   | Orgs with at least one active project in the last 30 days   |
| Tasks Created          | Volume indicator for platform engagement                    |
| Plan Conversion Rate   | Percentage of Free orgs upgrading to Pro or Business        |
| Real-time Event Volume | Total WebSocket events emitted per day                      |
| Email Delivery Rate    | Percentage of BullMQ email jobs delivered successfully      |
| AI Suggestion Adoption | Percentage of `/ai/suggest` calls followed by task creation |

---

## 16. Glossary

| Term                  | Definition                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **DTO**               | Data Transfer Object, a TypeScript class decorated with `class-validator` constraints used to validate and type incoming request bodies     |
| **Guard**             | NestJS mechanism for authorization, runs before a route handler and can block the request (e.g. `JwtAuthGuard`, `RolesGuard`, `AdminGuard`) |
| **Interceptor**       | NestJS class that wraps request/response lifecycle, used for logging, response transformation, caching, and idempotency checking            |
| **Pipe**              | NestJS class that validates and transforms incoming data before it reaches the controller (e.g. global `ValidationPipe`)                    |
| **Custom Decorator**  | NestJS `createParamDecorator` or `SetMetadata` factory, e.g. `@CurrentUser()`, `@Public()`, `@Roles()`, `@RequiresPlan()`, `@UseCache()`    |
| **BullMQ**            | Redis-backed job queue library for async background task processing (email delivery, Excel export, scheduled reminders)                     |
| **Dead-Letter Queue** | BullMQ queue receiving jobs that have exhausted all retry attempts, used for inspection and manual replay via the Admin module              |
| **Cron Job**          | Scheduled task running on a fixed time pattern via `@nestjs/schedule` `@Cron()` decorator (e.g. daily due-date reminder at 08:00 UTC)       |
| **Prisma**            | Type-safe ORM for PostgreSQL, generates a fully-typed client from the schema, migrations managed via `prisma migrate`                       |
| **JWT**               | JSON Web Token, compact, signed token used for stateless authentication                                                                     |
| **Refresh Token**     | Long-lived token used to obtain a new access token without re-authenticating, stored hashed in Redis and rotated on every use               |
| **Soft Delete**       | Marking a record as deleted via `deletedAt` timestamp without removing it from the database, allows recovery                                |
| **WebSocket Gateway** | NestJS `@WebSocketGateway()` class that handles Socket.IO connections, room management, and event emission                                  |
| **Redis Adapter**     | `@socket.io/redis-adapter`, synchronises Socket.IO events across multiple server instances via Redis pub/sub                                |
| **Distributed Lock**  | Redis `SETNX`-based mechanism that prevents multiple server instances from concurrently executing the same critical section                 |
| **Idempotency Key**   | A unique client-generated header (`Idempotency-Key`) on `POST /tasks`; prevents duplicate resource creation on network retry                |
| **Stripe Webhook**    | HTTP POST sent by Stripe to notify the server of billing events (payment succeeded, subscription cancelled, etc.)                           |
| **Idempotency**       | Property of an operation where performing it multiple times produces the same result, applied to Stripe webhook handlers and task creation  |
| **SSE**               | Server-Sent Events, one-directional HTTP streaming used to push AI response tokens to the client progressively                              |
| **Plan Guard**        | NestJS guard that reads the organization's current `Plan` and blocks access to endpoints requiring a higher tier                            |
| **State Machine**     | Pattern for enforcing valid transitions between task statuses (TODO → IN_PROGRESS → IN_REVIEW → DONE)                                       |
| **@Mention**          | `@username` pattern in a comment body, parsed server-side after save to trigger targeted notifications                                      |
| **Task Watcher**      | A user who has subscribed to all change notifications for a specific task without being its assignee or owner                               |
| **OrgRole**           | Role assigned to a user within an organization: `OWNER`, `ADMIN`, or `MEMBER`, controls what actions they can perform                       |
| **Super Admin**       | Platform-level privileged role (`systemRole: SUPER_ADMIN`), with access to `/admin/*` routes, separate from org-level roles                 |
| **AuditLog**          | Immutable record of every admin action (ban, unban, job retry), with actor, target, and timestamp, for accountability                       |
| **ExcelJS**           | Node.js library for generating styled `.xlsx` files, used by the Export module to produce task data spreadsheets                            |
| **Handlebars**        | Templating engine for producing styled HTML email templates, separates email layout from business logic                                     |
