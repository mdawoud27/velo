import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Audit } from './decorators/audit.decorator';
import { BanUserDto, ListUsersDto, OverridePlanDto } from './dtos';
import { CurrentUser } from 'src/auth/decorators';
import {
  ApiDataResponse,
  ApiPaginatedDataResponse,
  ApiMessageResponse,
  ApiErrorResponses,
  ResponseMessage,
} from 'src/common/decorators';
import { PaginationDto } from 'src/common/dtos';
import { AdminOnly } from 'src/auth/decorators/admin-only.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Platform stats
  @Get('stats')
  @ResponseMessage('Platform stats retrieved')
  @ApiOperation({ summary: 'Get platform-wide statistics' })
  @ApiDataResponse(Object, 'Platform statistics')
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  // User management
  @Get('users')
  @ResponseMessage('Users retrieved')
  @ApiOperation({ summary: 'List all users' })
  @ApiPaginatedDataResponse(Object, 'User list')
  @ApiErrorResponses(401, 403)
  listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Patch('users/:userId/ban')
  @Audit('admin.user.banned')
  @ResponseMessage('User banned successfully')
  @ApiOperation({ summary: 'Ban a user account' })
  @ApiMessageResponse('User banned')
  @ApiErrorResponses(400, 401, 403, 404)
  @HttpCode(HttpStatus.OK)
  banUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BanUserDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.adminService.banUser(userId, actorId, dto.reason);
  }

  @Patch('users/:userId/unban')
  @Audit('admin.user.unbanned')
  @ResponseMessage('User unbanned successfully')
  @ApiOperation({ summary: 'Unban a user account' })
  @ApiMessageResponse('User unbanned')
  @ApiErrorResponses(400, 401, 403, 404)
  @HttpCode(HttpStatus.OK)
  unbanUser(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser('sub') actorId: string) {
    return this.adminService.unbanUser(userId, actorId);
  }

  @Patch('users/:userId/promote')
  @Audit('admin.user.promoted')
  @ResponseMessage('User promoted to super admin')
  @ApiOperation({ summary: 'Promote a user to SUPER_ADMIN' })
  @ApiMessageResponse('User promoted')
  @ApiErrorResponses(400, 401, 403, 404)
  @HttpCode(HttpStatus.OK)
  promoteUser(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser('sub') actorId: string) {
    return this.adminService.promoteToAdmin(userId, actorId);
  }

  // Task management
  @Get('tasks/deleted')
  @ResponseMessage('Deleted tasks retrieved')
  @ApiOperation({ summary: 'List tasks soft-deleted within the last 30 days' })
  @ApiPaginatedDataResponse(Object)
  @ApiErrorResponses(401, 403)
  listDeletedTasks(@Query() dto: PaginationDto) {
    return this.adminService.listDeletedTasks(dto);
  }

  @Post('tasks/:taskId/restore')
  @Audit('admin.task.restored')
  @ResponseMessage('Task restored successfully')
  @ApiOperation({ summary: 'Restore a soft-deleted task (within 30 days)' })
  @ApiDataResponse(Object, 'Restored task')
  @ApiErrorResponses(400, 401, 403, 404)
  restoreTask(@Param('taskId', ParseUUIDPipe) taskId: string, @CurrentUser('sub') actorId: string) {
    return this.adminService.restoreTask(taskId, actorId);
  }

  // Organization management
  @Patch('organizations/:orgId/plan')
  @Audit('admin.org.plan_overridden')
  @ResponseMessage('Organization plan updated')
  @ApiOperation({ summary: 'Override an organization plan (for support/manual adjustments)' })
  @ApiMessageResponse('Plan updated')
  @ApiErrorResponses(400, 401, 403, 404)
  @HttpCode(HttpStatus.OK)
  overrideOrgPlan(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: OverridePlanDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.adminService.overridePlan(orgId, dto.plan, actorId);
  }

  // Audit log
  @Get('audit-logs')
  @ResponseMessage('Audit logs retrieved')
  @ApiOperation({ summary: 'List admin audit logs' })
  @ApiPaginatedDataResponse(Object)
  @ApiErrorResponses(401, 403)
  getAuditLogs(
    @Query() dto: PaginationDto,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
  ) {
    return this.adminService.getAuditLogs({ ...dto, actorId, action });
  }

  // Queue management
  @Get('queues/:queueName')
  @ResponseMessage('Queue stats retrieved')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiDataResponse(Object, 'Queue stats')
  @ApiErrorResponses(401, 403, 404)
  getQueueStats(@Param('queueName') queueName: string) {
    return this.adminService.getQueueStats(queueName);
  }

  @Get('queues/:queueName/failed')
  @ResponseMessage('Failed jobs retrieved')
  @ApiOperation({ summary: 'List failed jobs in a queue' })
  @ApiPaginatedDataResponse(Object)
  @ApiErrorResponses(401, 403, 404)
  getFailedJobs(@Param('queueName') queueName: string, @Query() dto: PaginationDto) {
    return this.adminService.getFailedJobs(queueName, dto);
  }

  @Post('queues/:queueName/jobs/:jobId/retry')
  @Audit('admin.queue.job.retried')
  @ResponseMessage('Job queued for retry')
  @ApiOperation({ summary: 'Retry a failed job' })
  @ApiMessageResponse('Job retried')
  @ApiErrorResponses(400, 401, 403, 404)
  @HttpCode(HttpStatus.OK)
  retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.adminService.retryJob(queueName, jobId, actorId);
  }

  @Delete('queues/:queueName/jobs/:jobId')
  @Audit('admin.queue.job.deleted')
  @ResponseMessage('Job deleted')
  @ApiOperation({ summary: 'Delete a job from a queue' })
  @ApiMessageResponse('Job deleted')
  @ApiErrorResponses(400, 401, 403, 404)
  @HttpCode(HttpStatus.OK)
  deleteJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.adminService.deleteJob(queueName, jobId, actorId);
  }
}
