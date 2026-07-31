import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import {
  ApiErrorResponses,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { ListActivityLogsDto } from './dtos';
import { CurrentUser, Roles } from 'src/auth/decorators';
import { OrgRole } from '@prisma/client';
import { RolesGuard } from 'src/auth/guards';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @Roles(OrgRole.OWNER)
  @UseGuards(RolesGuard)
  @ResponseMessage('Activity logs retrieved successfully')
  @ApiOperation({ summary: 'List activity logs' })
  @ApiPaginatedDataResponse(Object, 'Activity logs list')
  @ApiErrorResponses(401, 403)
  listActivityLogs(@Query() dto: ListActivityLogsDto, @CurrentUser('sub') actorId: string) {
    return this.activityService.listActivityLogs({
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
      orgId: dto.orgId,
      projectId: dto.projectId,
      actorId: dto.actorId,
      entityType: dto.entityType,
      action: dto.action,
      requesterId: actorId,
    });
  }
}
