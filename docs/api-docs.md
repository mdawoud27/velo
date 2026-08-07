# Velo API Documentation

**Base URL:** `https://<host>/api/v1`
**API Docs UI:** `https://<host>/api-docs` (Swagger UI)

## Authentication

All endpoints require a Bearer JWT access token unless marked **Public**.

```bash
Authorization: Bearer <access_token>
```

Access tokens expire in **15 minutes**. Use `POST /auth/refresh-token` with a refresh token to rotate.

---

## Response Envelope

All API responses follow a unified response structure managed by global interceptors and filters.

### Success

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {},
  "timestamp": "Friday, August 7, 2026 at 11:27:31 AM GMT+3"
}
```

### Paginated List

```json
{
  "success": true,
  "message": "Tasks listed successfully.",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  },
  "timestamp": "Friday, August 7, 2026 at 11:27:31 AM GMT+3"
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "PLAN_LIMIT_REACHED",
    "message": "Free plan allows up to 3 members. Upgrade to Pro to add more."
  },
  "timestamp": "2026-08-07T08:27:45.000Z"
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
| 2FA endpoints  | 5 requests / minute per user |
| AI endpoints   | 10 requests / hour per user  |

Exceeded limits return `429 Too Many Requests` with error code `TOO_MANY_REQUESTS`.

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
  "message": "Check your inbox to verify your email",
  "data": { "id": "uuid", "email": "mo@example.com", "name": "Mohamed Dawoud" },
  "timestamp": "Friday, August 7, 2026 at 11:27:31 AM GMT+3"
}
```

---

#### `POST /resend-verification-email` Public

Resend verification email to user.

**Body:** `{ "email": "mo@example.com" }`

---

#### `POST /verify-email` Public

Confirm email address.

**Body:** `{ "token": "<verification_token>" }`

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
  "message": "User logged in successfully",
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "name": "Mohamed Dawoud", "email": "mo@example.com" }
  },
  "timestamp": "Friday, August 7, 2026 at 11:27:31 AM GMT+3"
}
```

---

#### `POST /2fa/generate`

Generate 2FA secret and QR code.

**Response `200`:** Returns 2FA secret URI and QR code image URL.

---

#### `POST /2fa/enable`

Enable 2FA using a TOTP verification code.

**Body:** `{ "token": "123456" }`

---

#### `POST /2fa/disable`

Disable 2FA using a TOTP verification code.

**Body:** `{ "token": "123456" }`

---

#### `POST /2fa/verify` Public

Verify 2FA token or backup code during login flow.

**Body:** `{ "tempToken": "eyJ...", "code": "123456" }`

---

#### `POST /refresh-token` Public

Rotate the refresh token and receive a new access token.

**Body:** `{ "refreshToken": "eyJ..." }`

**Response `200`:**

```json
{
  "success": true,
  "message": "New tokens generated successfully",
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." },
  "timestamp": "Friday, August 7, 2026 at 11:27:31 AM GMT+3"
}
```

---

#### `GET /google` Public

Initiate Google OAuth flow.

#### `GET /google/callback` Public

Google OAuth callback.

#### `GET /github` Public

Initiate GitHub OAuth flow.

#### `GET /github/callback` Public

GitHub OAuth callback.

#### `POST /exchange-code` Public

Exchange one-time OAuth code for JWT tokens.

**Body:** `{ "code": "<oauth_code>" }`

---

#### `POST /forgot-password` Public

Request a password reset email.

**Body:** `{ "email": "mo@example.com" }`

---

#### `POST /reset-password` Public

Set a new password using a reset token.

**Body:** `{ "token": "<reset_token>", "password": "NewP@ssw0rd" }`

---

#### `POST /logout`

Invalidate current session.

---

### Users: `/api/v1/users`

#### `GET /me`

Get authenticated user profile.

---

#### `PATCH /me`

Update profile details.

**Body:** `{ "name": "New Name" }`

---

#### `GET /me/notification-preferences`

Get notification preferences.

---

#### `PATCH /me/notification-preferences`

Update notification preferences.

---

#### `PATCH /me/password`

Change password while logged in.

**Body:** `{ "currentPassword": "OldP@ss", "newPassword": "NewP@ss" }`

---

#### `DELETE /me`

Soft-delete own account.

---

#### `PATCH /me/avatar`

Upload user avatar (`multipart/form-data`, field: `avatar`, max 5 MB).

---

#### `DELETE /me/avatar`

Delete user avatar.

---

### Organizations: `/api/v1/organizations`

#### `POST /`

Create a new organization. Supports idempotency key header.

**Body:** `{ "name": "Acme Corp", "description": "Software agency" }`

---

#### `GET /me`

List all organizations the current user belongs to.

**Query:** `?page=1&limit=20`

---

#### `POST /:orgId/invite`

Invite a member to the organization by email. **Role:** Owner or Admin.

**Body:** `{ "email": "sara@example.com", "role": "MEMBER" }`

---

#### `POST /:orgId/invitations/bulk`

Invite multiple members in bulk. **Role:** Owner or Admin.

**Body:** `{ "invitations": [{ "email": "a@ex.com", "role": "MEMBER" }] }`

---

#### `POST /:orgId/resend`

Resend an invitation. **Role:** Owner or Admin.

---

#### `POST /:orgId/accept`

Accept an organization invitation.

**Body:** `{ "token": "<invite_token>" }`

---

#### `POST /:orgId/decline`

Decline an organization invitation.

**Body:** `{ "token": "<invite_token>" }`

---

#### `GET /:orgId/invitations`

List pending invitations for the organization. **Role:** Owner or Admin.

---

### Teams: `/api/v1/organizations/:orgId/teams`

#### `POST /`

Create a team inside an organization. Supports idempotency key header.

**Body:** `{ "name": "Backend Team", "description": "Core dev team" }`

---

#### `GET /`

List all teams in the organization.

**Query:** `?page=1&limit=20`

---

#### `GET /:id`

Get team details.

---

#### `PATCH /:id`

Update team details. **Role:** Owner or Admin.

---

#### `DELETE /:id`

Soft-delete a team. **Role:** Owner or Admin.

---

#### `POST /:id/members`

Add a member to the team. **Role:** Owner or Admin.

**Body:** `{ "userId": "uuid", "role": "MEMBER" }`

---

#### `GET /:id/members`

List team members.

**Query:** `?page=1&limit=20`

---

#### `PATCH /:id/members/:userId`

Update team member role. **Role:** Owner or Admin.

**Body:** `{ "role": "LEAD" }`

---

#### `DELETE /:id/members/:userId`

Remove member from team. **Role:** Owner or Admin.

---

### Projects: `/api/v1/organizations/:orgId/teams/:teamId/projects`

#### `POST /`

Create a project inside a team. Supports idempotency key header.

**Body:**

```json
{
  "name": "API Redesign",
  "description": "Redesign project",
  "deadline": "2026-09-01T00:00:00Z"
}
```

---

#### `GET /`

List all projects in the team.

**Query:** `?page=1&limit=20`

---

#### `GET /:id`

Get project details.

---

#### `PATCH /:id`

Update project details.

---

#### `PATCH /:id/status`

Archive or reactivate a project.

**Body:** `{ "status": "ARCHIVED" }`

---

#### `DELETE /:id`

Delete an archived project.

---

#### `POST /:id/members`

Add a team member to the project.

**Body:** `{ "userId": "uuid" }`

---

#### `GET /:id/members`

List project members.

---

#### `DELETE /:id/members`

Remove a member from the project.

**Body:** `{ "userId": "uuid" }`

---

#### `GET /:id/board`

Get Kanban board tasks grouped by status.

---

#### `GET /:id/summary`

Get task counts aggregated by status and overdue status.

---

#### `POST /:id/export`

Request an Excel export job for the project.

**Response `201`:** `{ "data": { "jobId": "bullmq-job-id" } }`

---

#### `GET /:id/export/status`

Poll status of a project export job.

**Query:** `?jobId=<job_id>`

---

### Tasks: `/api/v1/organizations/:orgId/teams/:teamId/projects/:projectId/tasks`

#### `POST /`

Create a task inside a project. Supports idempotency key header.

**Body:**

```json
{
  "title": "Implement refresh token rotation",
  "description": "Use SETNX pattern in Redis...",
  "assigneeId": "uuid",
  "priority": "HIGH",
  "status": "TODO",
  "dueDate": "2026-07-15T00:00:00Z",
  "tags": ["auth", "redis"],
  "parentTaskId": null
}
```

---

#### `GET /`

List and filter tasks in the project.

**Query parameters:** `status`, `assigneeId`, `priority`, `tags`, `tagsMode`, `untaggedOnly`, `page`, `limit`

---

#### `GET /search`

Full-text search tasks by title and description.

**Query:** `?query=token&page=1&limit=20`

---

#### `GET /:id`

Get full task detail.

---

#### `PATCH /:id`

Update task fields.

---

#### `PATCH /:id/status`

Update task status transition.

**Body:** `{ "status": "IN_PROGRESS" }`

---

#### `DELETE /:id`

Soft-delete task.

---

#### `PATCH /:id/tags`

Add tags to task.

**Body:** `{ "tags": ["frontend", "v2"] }`

---

#### `DELETE /:id/tags`

Remove tags from task.

**Body:** `{ "tags": ["v2"] }`

---

#### `POST /:id/watch`

Watch a task.

---

#### `DELETE /:id/watch`

Unwatch a task.

---

#### `POST /:id/attachments`

Upload attachments to a task (`multipart/form-data`, field: `files`, max 10 MB per file).

---

### Comments: `/api/v1/organizations/:orgId/teams/:teamId/projects/:projectId/tasks/:taskId/comments`

#### `POST /`

Create a comment on a task. Parse `@mentions` in body.

**Body:** `{ "body": "Hey @sara check this PR" }`

---

#### `GET /`

List comments on a task.

---

#### `PATCH /:id`

Update comment body.

---

#### `DELETE /:id`

Soft-delete comment.

---

### Activity Logs: `/api/v1/activity-logs`

#### `GET /`

List activity audit trail for organization/project. **Role:** Org Owner.

**Query:** `?orgId=uuid&projectId=uuid&actorId=uuid&entityType=Task&action=task.created&page=1&limit=10`

---

### Billing: `/api/v1/billing`

#### `POST /checkout`

Create a Stripe Checkout session for plan upgrade.

**Body:** `{ "plan": "PRO" }`

---

#### `POST /portal`

Create a Stripe Customer Portal session.

---

#### `GET /subscription`

Get current organization subscription status.

---

#### `POST /webhook` Public

Stripe webhook endpoint.

---

### AI: `/api/v1/ai`

Requires `PRO` or `BUSINESS` plan. Rate limit: 10 requests / hour per user.

#### `POST /suggest`

Generate AI task suggestions (JSON response).

**Body:** `{ "prompt": "Break down authentication workflow" }`

---

#### `GET /suggest/stream` SSE

Stream AI task suggestions via Server-Sent Events.

---

### Admin: `/api/v1/admin`

Requires `SUPER_ADMIN` system role.

#### `GET /stats`

Get platform-wide statistics.

#### `GET /users`

List all platform users.

#### `PATCH /users/:userId/ban`

Ban a user account (`{ "reason": "Spamming" }`).

#### `PATCH /users/:userId/unban`

Unban a user account.

#### `PATCH /users/:userId/restore`

Restore a soft-deleted user account.

#### `PATCH /users/:userId/promote`

Promote a user to `SUPER_ADMIN`.

#### `PATCH /organizations/:orgId/plan`

Override organization plan (`{ "plan": "BUSINESS" }`).

#### `GET /tasks/deleted`

List soft-deleted tasks.

#### `POST /tasks/:taskId/restore`

Restore a soft-deleted task.

#### `GET /audit-logs`

List admin audit logs.

#### `GET /queues/:queueName`

Get BullMQ queue statistics.

#### `GET /queues/:queueName/failed`

List failed jobs in a queue.

#### `POST /queues/:queueName/jobs/:jobId/retry`

Retry a failed BullMQ job.

#### `DELETE /queues/:queueName/jobs/:jobId`

Delete a job from a queue.

---

### Health: `/health`

Get system health check (database, redis, memory).
