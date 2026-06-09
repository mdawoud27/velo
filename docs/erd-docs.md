# Velo Entity Relationship Diagram (ERD) Documentation

## Overview

Velo's database is a **PostgreSQL** relational database managed via **Prisma ORM**. The schema models a three-level hierarchy: `Organization → Team → Project → Task`, with cross-cutting entities for collaboration (Comments, Attachments, Notifications, ActivityLog) and billing (StripeEvent).

---

## Entity Details

### Core Hierarchy

#### `User`

The central actor in the system. Users participate in organizations, teams, and projects through junction tables.

| Field              | Type      | Notes                                          |
| ------------------ | --------- | ---------------------------------------------- |
| `id`               | UUID      | PK, auto-generated                             |
| `email`            | String    | Unique, used for login & invites               |
| `password`         | String?   | Null for Google OAuth users                    |
| `name`             | String    | Display name                                   |
| `avatarUrl`        | String?   | Cloudinary URL                                 |
| `isEmailVerified`  | Boolean   | Default `false`; must be `true` to create orgs |
| `googleId`         | String?   | Unique; set on OAuth login                     |
| `systemRole`       | Enum      | `USER` \| `SUPER_ADMIN`                        |
| `bannedAt`         | DateTime? | Non-null = banned, blocks all requests         |
| `notifPreferences` | JSON      | Per-notification-type opt-out flags            |
| `stripeCustomerId` | String?   | Stripe customer reference                      |

---

#### `Organization`

Top-level tenant. Contains teams. Billing state is tracked here.

| Field                  | Type      | Notes                         |
| ---------------------- | --------- | ----------------------------- |
| `id`                   | UUID      | PK                            |
| `name`                 | String    | Display name                  |
| `plan`                 | Enum      | `FREE` \| `PRO` \| `BUSINESS` |
| `stripeCustomerId`     | String?   | Unique Stripe customer ID     |
| `stripeSubscriptionId` | String?   | Active subscription reference |
| `deletedAt`            | DateTime? | Soft delete; nullifies access |

**Plan Limits:**

| Plan     | Max Members | Price  |
| -------- | ----------- | ------ |
| FREE     | 3           | $0     |
| PRO      | 20          | $9/mo  |
| BUSINESS | Unlimited   | $29/mo |

---

#### `OrgMember` _(Junction)_

Many-to-many between `User` and `Organization` with a role.

| Field    | Type | Notes                          |
| -------- | ---- | ------------------------------ |
| `userId` | UUID | FK → User                      |
| `orgId`  | UUID | FK → Organization              |
| `role`   | Enum | `OWNER` \| `ADMIN` \| `MEMBER` |
| Unique   |      | `(userId, orgId)`              |

---

#### `Team`

Belongs to an Organization. Groups members and owns Projects.

| Field       | Type      | Notes                                     |
| ----------- | --------- | ----------------------------------------- |
| `orgId`     | UUID      | FK → Organization                         |
| `deletedAt` | DateTime? | Soft delete; cascades to ARCHIVE projects |

---

#### `TeamMember` _(Junction)_

Many-to-many between `User` and `Team`.

| Unique | `(userId, teamId)` |
| ------ | ------------------ |

---

#### `Project`

Belongs to a Team. Contains Tasks. Has two inactive states: ARCHIVED (read-only, visible) and soft-deleted (hidden).

| Field       | Type      | Notes                                  |
| ----------- | --------- | -------------------------------------- |
| `status`    | Enum      | `ACTIVE` \| `ARCHIVED`                 |
| `teamId`    | UUID      | FK → Team                              |
| `deletedAt` | DateTime? | Soft delete; excludes from all queries |

---

#### `ProjectMember` _(Junction)_

Many-to-many between `User` and `Project`.

| Unique | `(userId, projectId)` |
| ------ | --------------------- |

---

#### `Task`

Core work unit. Self-referential for subtasks. Has status machine: `TODO → IN_PROGRESS → IN_REVIEW → DONE`.

| Field          | Type      | Notes                                            |
| -------------- | --------- | ------------------------------------------------ |
| `status`       | Enum      | `TODO` \| `IN_PROGRESS` \| `IN_REVIEW` \| `DONE` |
| `priority`     | Enum      | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT`          |
| `assigneeId`   | UUID?     | FK → User (nullable)                             |
| `creatorId`    | UUID      | FK → User                                        |
| `parentTaskId` | UUID?     | FK → Task (self-ref, for subtasks)               |
| `tags`         | String[]  | PostgreSQL array                                 |
| `deletedAt`    | DateTime? | Soft delete; recoverable within 30 days          |

---

### Collaboration Entities

#### `Comment`

Attached to a Task. Supports `@mention` parsing. Soft-deletable (body replaced with `[deleted]`).

#### `Attachment`

File uploaded to Cloudinary/S3 and linked to a Task. Max 10 MB. Stores filename, URL, size, and uploader.

#### `TaskWatcher`

Junction between User and Task. Watchers receive all task change notifications without being the assignee.

| Unique | `(userId, taskId)` |
| ------ | ------------------ |

#### `ActivityLog`

Immutable audit trail of every domain event. Stores `action` (e.g. `task.status.changed`), `entityType`, `entityId`, and a `metadata` JSON blob with before/after values.

#### `Notification`

In-app notification delivered to a user in real-time via WebSocket. Tracks `isRead` state.

---

### Admin & Billing Entities

#### `AuditLog`

Records every admin action (ban, unban, job retry) with actor, target, and timestamp. Separate from `ActivityLog` (which is for domain events).

#### `StripeEvent`

Idempotency table. Stores processed Stripe event IDs (`evt_xxx`) to prevent duplicate webhook handling. Primary key is the Stripe event ID itself, and duplicate inserts fail by PK conflict.

---

## Key Relationships Summary

```text
User ────────────────── OrgMember ────────── Organization
User ────────────────── TeamMember ─────────── Team
User ────────────────── ProjectMember ──────── Project
Organization ──────────────────────────────────────────► Team (1:many)
Team ──────────────────────────────────────────────────► Project (1:many)
Project ───────────────────────────────────────────────► Task (1:many)
Task ──────────────────────────────────────────────────► Task (self-ref, subtasks)
Task ─────────────────────────────────────────────────── Comment / Attachment / ActivityLog / TaskWatcher
User ────── (assignee) ──► Task
User ────── (creator) ───► Task
User ──────────────────────────────────────────────────► Notification
User ──────────────────────────────────────────────────► AuditLog
```

---

## Cascade & Deletion Rules

| Deleted Entity   | Cascade Behavior                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| **Organization** | Soft-deleted → all teams/projects/tasks archived; members lose access                                         |
| **Team**         | `deletedAt` set → child projects set to `ARCHIVED` status (NOT soft-deleted)                                  |
| **Project**      | `DELETE /:id` → `deletedAt` set, hidden from queries. `PATCH { status: ARCHIVED }` → read-only, still visible |
| **Task**         | `deletedAt` set → recoverable within 30 days via admin restore                                                |
| **User**         | Account deactivated via `bannedAt`; task history preserved; reassignment required                             |
| **Comment**      | Soft-deleted → body replaced with `[deleted]`                                                                 |

---

## Enums Reference

| Enum            | Values                                     |
| --------------- | ------------------------------------------ |
| `SystemRole`    | `USER`, `SUPER_ADMIN`                      |
| `OrgRole`       | `OWNER`, `ADMIN`, `MEMBER`                 |
| `Plan`          | `FREE`, `PRO`, `BUSINESS`                  |
| `TeamRole`      | `LEAD`, `MEMBER`                           |
| `ProjectStatus` | `ACTIVE`, `ARCHIVED`                       |
| `TaskStatus`    | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` |
| `Priority`      | `LOW`, `MEDIUM`, `HIGH`, `URGENT`          |
