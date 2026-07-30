import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import {
  ApiErrorResponses,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { PaginationDto } from 'src/common/dtos';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ResponseMessage('Activity logs retrieved successfully')
  @ApiOperation({ summary: 'List activity logs' })
  @ApiPaginatedDataResponse(Object, 'Activity logs list')
  @ApiErrorResponses(401, 403)
  listActivityLogs(
    @Query() dto: PaginationDto,
    @Query('orgId') orgId?: string,
    @Query('projectId') projectId?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    return this.activityService.listActivityLogs({
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
      orgId,
      projectId,
      actorId,
      entityType,
      action,
    });
  }
}
