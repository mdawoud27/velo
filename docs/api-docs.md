# Velo API Documentation

**Base URL:** `https://<host>/api/v1`
**API Docs UI:** `https://<host>/api/docs` (Swagger UI)

## Authentication

All endpoints require a Bearer JWT access token unless marked **Public**.

```bash
Authorization: Bearer <access_token>
```

Access tokens expire in **15 minutes**. Use `POST /auth/refresh` with a refresh token to rotate.

---

## Response Envelope

All responses share a consistent shape:

### Success

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {}
}
```

### Paginated List

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

### Error

```json
{
  "success": false,
  "statusCode": 403,
  "error": "PLAN_LIMIT_REACHED",
  "message": "Free plan allows up to 3 members. Upgrade to Pro to add more.",
  "upgradeUrl": "https://app.velo.dev/billing",
  "timestamp": "2026-06-01T10:00:00Z",
  "path": "/api/v1/organizations/abc/invite"
}
```

---

## Common Error Codes

| Code                   | HTTP | Meaning                                      |
| ---------------------- | ---- | -------------------------------------------- |
| `UNAUTHORIZED`         | 401  | Missing or invalid JWT                       |
| `FORBIDDEN`            | 403  | Insufficient role or plan                    |
| `NOT_FOUND`            | 404  | Resource does not exist                      |
| `CONFLICT`             | 409  | Duplicate resource (e.g., already a member)  |
| `UNPROCESSABLE_ENTITY` | 422  | Invalid state transition (e.g., task status) |
| `PLAN_LIMIT_REACHED`   | 403  | Seat limit hit; upgrade required             |
| `TOO_MANY_REQUESTS`    | 429  | Rate limit exceeded                          |
| `BANNED`               | 403  | User account has been banned                 |

---

## Rate Limits

| Scope          | Limit                        |
| -------------- | ---------------------------- |
| Global         | 100 requests / minute per IP |
| Auth endpoints | 10 requests / minute per IP  |
| AI endpoints   | 10 requests / hour per user  |

Exceeded limits return `429 Too Many Requests` with a `Retry-After` header.

---

## Endpoints

---

### Auth: `/api/v1/auth`

#### `POST /register` Public

Register a new user account.

**Body:**

```json
{
  "name": "Mohamed Dawoud",
  "email": "mo@example.com",
  "password": "S3cur3P@ssw0rd"
}
```

**Response `201`:**

```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": { "id": "uuid", "email": "mo@example.com", "name": "Mohamed Dawoud" }
}
```

**Side effects:** Enqueues verification email via BullMQ. Token stored in Redis (TTL: 24h).

---

#### `POST /login` Public

Authenticate and receive JWT tokens.

**Body:**

```json
{ "email": "mo@example.com", "password": "S3cur3P@ssw0rd" }
```

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "name": "Mohamed Dawoud", "email": "mo@example.com" }
  }
}
```

---

#### `GET /google` Public

Redirects to Google OAuth consent screen.

#### `GET /google/callback` Public

Google OAuth callback. Auto-creates account on first login; links to existing account if email matches. Returns JWT tokens.

---

#### `POST /verify-email` Public

Confirm email address.

**Body:** `{ "token": "<verification_token>" }`

---

#### `POST /forgot-password` Public

Request a password reset email.

**Body:** `{ "email": "mo@example.com" }`

**Side effects:** Enqueues reset email. Token stored in Redis (TTL: 1h).

---

#### `POST /reset-password` Public

Set a new password using a reset token.

**Body:** `{ "token": "<reset_token>", "password": "NewP@ssw0rd" }`

---

#### `POST /refresh` Refresh Token

Rotate the refresh token and receive a new access token.

**Header:** `Authorization: Bearer <refresh_token>`

**Response `200`:**

```json
{
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

**Notes:** Old refresh token is deleted atomically. New token written in same Redis operation.

---

#### `POST /logout`

Invalidate the current session.

**Side effects:** Refresh token deleted from Redis. Access token JTI added to Redis blacklist (TTL: remaining token lifetime).

---

### Users: `/api/v1/users`

#### `GET /me`

Get the authenticated user's profile.

**Response `200`:**

```json
{
  "data": {
    "id": "uuid",
    "email": "mo@example.com",
    "name": "Mohamed Dawoud",
    "avatarUrl": "https://res.cloudinary.com/...",
    "isEmailVerified": true,
    "systemRole": "USER",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

---

#### `PATCH /me`

Update profile name or avatar.

**Body:** `{ "name": "New Name", "avatarUrl": "https://..." }`

**Side effects:** Invalidates `cache:user-profile:{id}` in Redis.

---

#### `PATCH /me/password`

Change password while logged in.

**Body:** `{ "currentPassword": "OldP@ss", "newPassword": "NewP@ss" }`

---

#### `DELETE /me`

Deactivate own account.

---

### Organizations: `/api/v1/organizations`

#### `POST /`

Create a new organization. Caller becomes `OWNER`. Plan starts at `FREE`.

**Body:**

```json
{ "name": "Acme Corp", "description": "Our software agency" }
```

**Guard:** Requires `isEmailVerified = true`.

---

#### `GET /`

List all organizations the current user belongs to.

**Query:** `?page=1&limit=20`

---

#### `GET /:id`

Get organization details. **Role:** Member.

---

#### `PATCH /:id`

Update name or description. **Role:** Owner or Admin.

**Body:** `{ "name": "New Name", "description": "Updated desc" }`

---

#### `DELETE /:id`

Soft-delete the organization. **Role:** Owner.

---

#### `POST /:id/invite`

Invite a user by email. **Role:** Owner or Admin.

**Body:** `{ "email": "sara@example.com", "role": "MEMBER" }`

**Side effects:** Enqueues invite email with a token link.

**Error:** Returns `PLAN_LIMIT_REACHED` with upgrade URL if seat limit would be exceeded.

---

#### `POST /:id/invitations/:token/accept` Public

Accept an organization invitation.

#### `POST /:id/invitations/:token/decline` Public

Decline an organization invitation.

---

#### `GET /:id/members`

List all members with their roles. **Role:** Member.

---

#### `PATCH /:id/members/:userId/role`

Change a member's role. **Role:** Owner or Admin.

**Body:** `{ "role": "ADMIN" }`

---

#### `DELETE /:id/members/:userId`

Remove a member. **Role:** Owner or Admin.

**Side effects:** Removes member from all teams within the organization.

---

### Teams: `/api/v1/teams`

#### `POST /`

Create a team inside an organization. **Role:** Org Admin.

**Body:** `{ "name": "Backend Team", "description": "...", "orgId": "uuid" }`

---

#### `GET /mine`

List all teams the current user belongs to.

---

#### `GET /:id`

Get team details. **Role:** Team Member.

---

#### `PATCH /:id`

Update team name or description. **Role:** Lead.

---

#### `DELETE /:id`

Soft-delete the team. **Role:** Lead or Org Admin.

**Side effects:** All child projects set to `ARCHIVED` status.

---

#### `POST /:id/members`

Add an organization member to the team. **Role:** Lead.

**Body:** `{ "userId": "uuid" }`

---

#### `DELETE /:id/members/:userId`

Remove a member from the team. **Role:** Lead.

**Notes:** Does NOT remove the user from the organization.

---

### Projects: `/api/v1/projects`

#### `POST /`

Create a project inside a team. **Role:** Lead.

**Body:**

```json
{
  "name": "API Redesign",
  "description": "...",
  "teamId": "uuid",
  "deadline": "2026-09-01T00:00:00Z"
}
```

---

#### `GET /mine`

List all projects the current user has access to.

---

#### `GET /:id`

Get project details. **Role:** Member.

---

#### `PATCH /:id`

Update project details or archive it. **Role:** Lead.

**Body:** `{ "name": "...", "status": "ARCHIVED", "deadline": "2026-10-01T00:00:00Z" }`

**Notes:** Setting `status: "ARCHIVED"` makes the project read-only but keeps it visible.

---

#### `DELETE /:id`

Soft-delete the project. **Role:** Lead.

---

#### `GET /:id/summary`

Get aggregated task counts by status + overdue count.

**Response `200`:**

```json
{
  "data": {
    "todo": 12,
    "inProgress": 5,
    "inReview": 3,
    "done": 28,
    "overdue": 2,
    "total": 48
  }
}
```

---

#### `GET /:id/board`

Get tasks grouped by status for Kanban display. Cached 30 seconds in Redis.

**Response `200`:**

```json
{
  "data": {
    "TODO": [{ "id": "...", "title": "...", "priority": "HIGH", "assignee": {} }],
    "IN_PROGRESS": [],
    "IN_REVIEW": [],
    "DONE": []
  }
}
```

---

#### `POST /:id/export`

Enqueue an Excel export job. **Role:** Lead.

**Side effects:** BullMQ job created → ExcelJS generates styled `.xlsx` → uploaded to Cloudinary → download link emailed to requester.

**Response `202`:**

```json
{ "data": { "jobId": "bullmq-job-id" } }
```

---

#### `GET /:id/export/status`

Check export job status.

**Response `200`:**

```json
{
  "data": {
    "status": "done",
    "downloadUrl": "https://res.cloudinary.com/...",
    "completedAt": "2026-06-01T10:05:00Z"
  }
}
```

Possible `status` values: `pending`, `processing`, `done`, `failed`.

---

#### `POST /:id/members`

Add a member to the project. **Role:** Lead.

**Body:** `{ "userId": "uuid" }`

---

#### `DELETE /:id/members/:userId`

Remove a member from the project. **Role:** Lead.

---

#### `GET /:id/activity`

Get project-level activity feed. **Role:** Member.

**Query:** `?page=1&limit=20&entityType=Task`

---

### Tasks: `/api/v1/tasks`

#### `POST /`

Create a task. Supports idempotency.

**Header:** `Idempotency-Key: <unique-client-key>` (optional; prevents duplicate creation on retry)

**Body:**

```json
{
  "title": "Implement refresh token rotation",
  "description": "Use SETNX pattern in Redis...",
  "projectId": "uuid",
  "assigneeId": "uuid",
  "priority": "HIGH",
  "status": "TODO",
  "dueDate": "2026-07-15T00:00:00Z",
  "tags": ["auth", "redis"],
  "parentTaskId": null
}
```

**Side effects on assignment:** ActivityLog entry + in-app notification + BullMQ email job enqueued.

---

#### `GET /`

List tasks with filters.

**Query parameters:**

| Param        | Type   | Description                                |
| ------------ | ------ | ------------------------------------------ |
| `projectId`  | UUID   | Required. Filter by project                |
| `status`     | Enum   | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` |
| `assigneeId` | UUID   | Filter by assignee                         |
| `priority`   | Enum   | `LOW`, `MEDIUM`, `HIGH`, `URGENT`          |
| `search`     | String | Full-text search on title + description    |
| `page`       | Int    | Default: 1                                 |
| `limit`      | Int    | Default: 20                                |

---

#### `GET /:id`

Get full task detail including latest comments, attachments, and activity.

---

#### `PATCH /:id`

Update task fields.

**Body:** Any subset of task fields.

**Notes:** Status transitions enforced by state machine. Invalid transitions return `422`.

---

#### `DELETE /:id`

Soft-delete a task. Sets `deletedAt`. Recoverable within 30 days via admin.

---

#### `PATCH /bulk`

Bulk-update status or assignee on multiple tasks atomically. **Role:** Lead.

**Body:**

```json
{
  "taskIds": ["uuid1", "uuid2", "uuid3"],
  "update": { "status": "IN_REVIEW" }
}
```

Executed inside a Prisma transaction. Protected by Redis distributed lock.

---

#### `GET /:id/activity`

Task-level activity log.

**Query:** `?page=1&limit=20`

---

#### `POST /:id/watch`

Watch a task to receive all change notifications.

---

#### `DELETE /:id/watch`

Stop watching a task.

---

#### `GET /:id/watchers`

List all users watching a task.

---

### Comments: `/api/v1/comments`

#### `POST /`

Add a comment to a task.

**Body:**

```json
{
  "taskId": "uuid",
  "body": "Hey @sara can you take a look at this? The token rotation logic needs review."
}
```

**Side effects:** `@mention` usernames parsed; each match triggers a `MENTIONED` notification. Also notifies task owner + all previous commenters + watchers (deduped).

---

#### `GET /task/:taskId`

List all comments on a task in chronological order.

**Query:** `?page=1&limit=50`

---

#### `PATCH /:id`

Edit a comment. **Role:** Author only.

**Body:** `{ "body": "Updated comment text" }`

---

#### `DELETE /:id`

Soft-delete a comment. **Role:** Author or Project Admin.

Body replaced with `[deleted]` on soft-delete.

---

### Attachments: `/api/v1/attachments`

#### `POST /task/:taskId`

Upload a file attachment to a task. **Content-Type:** `multipart/form-data`

**Form field:** `file` (max 10 MB)

**Side effects:** File validated by Multer → uploaded to Cloudinary → URL stored in DB.

**Response `201`:**

```json
{
  "data": {
    "id": "uuid",
    "filename": "design-mockup.png",
    "url": "https://res.cloudinary.com/...",
    "size": 204800,
    "createdAt": "2026-06-01T10:00:00Z"
  }
}
```

---

#### `GET /task/:taskId`

List all attachments on a task.

---

#### `DELETE /:id`

Delete an attachment. **Role:** Uploader or Project Admin.

---

### Notifications: `/api/v1/notifications`

#### `GET /`

Get the authenticated user's notifications, paginated.

**Query:** `?page=1&limit=20&isRead=false`

---

#### `GET /unread-count`

Get the current unread notification count.

**Response `200`:**

```json
{ "data": { "count": 7 } }
```

---

#### `PATCH /:id/read`

Mark a single notification as read.

---

#### `PATCH /read-all`

Mark all notifications as read.

---

### Billing: `/api/v1/billing`

#### `GET /plans` Public

List all available subscription plans.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "maxMembers": 3,
      "features": ["3 members", "Basic tasks"]
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 9,
      "maxMembers": 20,
      "features": ["20 members", "Excel export", "AI suggestions"]
    },
    {
      "id": "business",
      "name": "Business",
      "price": 29,
      "maxMembers": null,
      "features": ["Unlimited members", "All features"]
    }
  ]
}
```

---

#### `POST /checkout`

Create a Stripe Checkout session. **Role:** Org Owner.

**Body:** `{ "orgId": "uuid", "plan": "PRO" }`

**Response `200`:**

```json
{ "data": { "checkoutUrl": "https://checkout.stripe.com/..." } }
```

---

#### `GET /subscription`

Get current subscription details for the caller's organization. **Role:** Org Owner.

**Response `200`:**

```json
{
  "data": {
    "plan": "PRO",
    "status": "active",
    "currentPeriodEnd": "2026-07-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

---

#### `POST /webhook` Stripe Signature (No JWT)

Stripe webhook receiver. Validates `Stripe-Signature` header via `stripe.webhooks.constructEvent()`.

**Handled events:**

| Stripe Event                    | Action                        |
| ------------------------------- | ----------------------------- |
| `checkout.session.completed`    | Upgrade org plan              |
| `invoice.paid`                  | Renew subscription            |
| `invoice.payment_failed`        | Enqueue payment failure email |
| `customer.subscription.deleted` | Downgrade org to FREE         |

**Idempotency:** Stripe event ID stored in `StripeEvent` table. Duplicate events detected by PK conflict and ignored.

---

### AI: `/api/v1/ai`

**Rate limit:** 10 requests / hour per user. Stored in Redis (`ai-rate:{userId}`, TTL: 1h).

#### `POST /suggest`

Get AI-generated task metadata from a plain-language description.

**Body:** `{ "description": "Build the password reset flow with email token and Redis TTL" }`

**Response `200`:**

```json
{
  "data": {
    "title": "Implement Password Reset Flow",
    "priority": "HIGH",
    "estimatedDeadline": "2026-06-15"
  }
}
```

**Rate limit exceeded -`429`:**

```json
{
  "success": false,
  "statusCode": 429,
  "error": "TOO_MANY_REQUESTS",
  "message": "AI request limit reached (10/hour). Try again later.",
  "retryAfter": 1800
}
```

---

#### `POST /suggest/stream`

Stream AI task suggestions token-by-token via Server-Sent Events.

**Body:** `{ "description": "Build real-time notifications with Socket.IO and Redis" }`

**Response:** SSE stream (`Content-Type: text/event-stream`)

```json
data: {"token": "Imp"}
data: {"token": "lement"}
data: {"token": " Real"}
...
data: {"done": true, "result": { "title": "...", "priority": "MEDIUM", "estimatedDeadline": "..." }}
```

**Note:** POST is used instead of GET to avoid exposing the description in server/proxy access logs via the query string.

---

### Admin: `/api/v1/admin`

**Guard:** All routes require `systemRole: SUPER_ADMIN`. Protected by `AdminGuard` layered on top of `JwtAuthGuard`.

All admin actions are recorded in `AuditLog` with actor, action, target entity, and timestamp.

---

#### `GET /users`

List all registered users.

**Query:** `?page=1&limit=20&search=sara&banned=false`

**Response:** Paginated list with `id`, `name`, `email`, `systemRole`, `bannedAt`, `createdAt`.

---

#### `PATCH /users/:id/ban`

Ban a user account. Sets `bannedAt = now()`. Banned users receive `403` on all subsequent requests.

---

#### `PATCH /users/:id/unban`

Unban a user. Clears `bannedAt`.

---

#### `GET /organizations`

List all organizations with plan info and member count.

**Query:** `?page=1&limit=20&plan=FREE`

---

#### `GET /stats`

Platform-wide statistics.

**Response `200`:**

```json
{
  "data": {
    "totalUsers": 1240,
    "verifiedUsers": 1180,
    "bannedUsers": 5,
    "totalOrganizations": 320,
    "activeOrganizations": 290,
    "totalProjects": 1850,
    "totalTasks": 14300,
    "activeSubscriptions": 85
  }
}
```

---

#### `GET /queues`

List all BullMQ queues with job counts.

**Response `200`:**

```json
{
  "data": [
    { "name": "email-queue", "active": 2, "waiting": 14, "failed": 1, "completed": 3820 },
    { "name": "export-queue", "active": 0, "waiting": 2, "failed": 0, "completed": 145 }
  ]
}
```

---

#### `GET /queues/:name/failed`

List failed jobs in a specific queue.

---

#### `POST /queues/:name/failed/:id/retry`

Manually retry a specific failed job.

---

#### `GET /audit`

Paginated audit log of all admin actions.

**Query:** `?page=1&limit=20&actorId=uuid&action=admin.user.banned`

---

#### `POST /tasks/:id/restore`

Restore a soft-deleted task. Only available within 30 days of deletion.

**Notes:** Sets `deletedAt = null`. Tasks older than 30 days are permanently purged by a scheduled cleanup job.

---

### Health: `/api/v1/health`

#### `GET /` Public

Check service health.

**Response `200`:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "up", "responseTimeMs": 4 },
    "redis": { "status": "up", "responseTimeMs": 1 }
  }
}
```

---

## WebSocket API (Socket.IO)

**Connection endpoint:** `wss://<host>`

**Authentication:** JWT must be passed on the handshake:

```javascript
const socket = io('wss://api.velo.dev', {
  auth: { token: '<access_token>' },
});
```

Invalid or expired tokens close the connection immediately with a `401` disconnect reason.

---

### Client → Server Events

| Event           | Payload                 | Description                                      |
| --------------- | ----------------------- | ------------------------------------------------ |
| `join:project`  | `{ projectId: string }` | Subscribe to a project's real-time board updates |
| `leave:project` | `{ projectId: string }` | Unsubscribe from a project room                  |

On connection, the server automatically adds the socket to the personal room `user:{userId}` for private notifications.

---

### Server → Client Events

#### Project room events (emitted to `project:{projectId}`)

| Event           | Payload                                      | Trigger                            |
| --------------- | -------------------------------------------- | ---------------------------------- |
| `task:created`  | `{ task: TaskObject }`                       | New task created in project        |
| `task:updated`  | `{ taskId: string, changes: Partial<Task> }` | Task fields updated                |
| `task:deleted`  | `{ taskId: string }`                         | Task soft-deleted                  |
| `comment:added` | `{ comment: CommentObject }`                 | New comment on any task in project |
| `user:joined`   | `{ userId: string, name: string }`           | User joined the project view       |
| `user:left`     | `{ userId: string }`                         | User left the project view         |

#### Personal room events (emitted to `user:{userId}`)

| Event              | Payload                                | Trigger                 |
| ------------------ | -------------------------------------- | ----------------------- |
| `notification:new` | `{ notification: NotificationObject }` | New in-app notification |

---

### Example Client Integration

```javascript
const socket = io('wss://api.velo.dev', {
  auth: { token: localStorage.getItem('accessToken') },
});

// Join a project board
socket.emit('join:project', { projectId: 'abc-123' });

// Listen for board changes
socket.on('task:created', ({ task }) => {
  addTaskToBoard(task);
});

socket.on('task:updated', ({ taskId, changes }) => {
  updateTaskOnBoard(taskId, changes);
});

socket.on('task:deleted', ({ taskId }) => {
  removeTaskFromBoard(taskId);
});

// Listen for personal notifications
socket.on('notification:new', ({ notification }) => {
  showToast(notification.title);
  incrementUnreadBadge();
});
```

---

## Email Notifications (BullMQ: `email-queue`)

Emails are queued asynchronously and processed by `EmailProcessor` using **Nodemailer** + **Handlebars** HTML templates. Queue retries: 3 attempts, exponential backoff. Failed jobs go to the dead-letter queue.

| Trigger                    | Template                    | Recipient                        |
| -------------------------- | --------------------------- | -------------------------------- |
| User registered            | `welcome-verify.hbs`        | New user                         |
| Task assigned              | `task-assigned.hbs`         | Assignee                         |
| Organization invite        | `org-invite.hbs`            | Invited user                     |
| Password reset requested   | `reset-password.hbs`        | User                             |
| Task due tomorrow          | `due-reminder.hbs`          | Assignee (daily cron 08:00 UTC)  |
| Payment failed             | `payment-failed.hbs`        | Org owner                        |
| Subscription expiring soon | `subscription-expiring.hbs` | Org owner (daily cron 09:00 UTC) |

---

## Scheduled Jobs

| Job                         | Cron        | Description                                                 |
| --------------------------- | ----------- | ----------------------------------------------------------- |
| Due-date reminders          | `0 8 * * *` | Emails assignees of tasks due tomorrow                      |
| Subscription expiry warning | `0 9 * * *` | Emails org owners whose subscription expires within 7 days  |
| Soft-delete cleanup         | `0 3 * * *` | Permanently purges tasks soft-deleted more than 30 days ago |
