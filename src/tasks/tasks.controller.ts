import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { CreateTaskDto, FilterTasksDto, TaskDto } from './dtos';
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

  @Get()
  @ResponseMessage('Tasks listed successfully.')
  @ApiOperation({ summary: 'List and filter tasks in a project' })
  @ApiPaginatedDataResponse(TaskDto, 'Tasks listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listTasks(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: FilterTasksDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.listTasks(orgId, teamId, projectId, dto, actorId);
  }

  @Get(':id')
  @ResponseMessage('Task fetched successfully.')
  @ApiOperation({ summary: 'Get task details' })
  @ApiDataResponse(TaskDto, 'Task fetched successfully.')
  @ApiErrorResponses(401, 403, 404)
  async getTask(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.getTask(id, projectId, teamId, orgId, actorId);
  }
}
