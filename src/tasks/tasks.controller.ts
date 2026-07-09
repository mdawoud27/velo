import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { ApiDataResponse, ApiErrorResponses, ResponseMessage } from 'src/common/decorators';
import { CreateTaskDto, TaskDto } from './dtos';
import { CurrentUser } from 'src/auth/decorators';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('organizations/:orgId/teams/:teamId/projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ResponseMessage('Task created successfully.')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiDataResponse(TaskDto, 'Task created successfully.')
  @ApiErrorResponses(401, 403, 404)
  async createTask(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.createTask(orgId, teamId, projectId, dto, actorId);
  }
}
