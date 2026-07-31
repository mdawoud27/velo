import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import {
  CreateTaskDto,
  FilterTasksDto,
  SearchTasksDto,
  TaskDto,
  TaskTagsDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dtos';
import { CurrentUser } from 'src/auth/decorators';
import { Cache } from 'src/cache/decorators';
import { requireParam } from 'src/cache/utils';
import { Idempotent } from 'src/idempotency/decorators';
import { CacheTags } from 'src/cache/cache.tags';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AttachmentEntity, AttachmentUploadResultDto } from './entities';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('organizations/:orgId/teams/:teamId/projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Idempotent(60 * 60 * 24)
  @ResponseMessage('Task created successfully.')
  @ApiOperation({ summary: 'Create a new task' })
  @ApiDataResponse(TaskDto, 'Task created successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
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
  @Cache(20, (req) => [
    CacheTags.project(requireParam(req, 'projectId')),
    CacheTags.team(requireParam(req, 'teamId')),
  ])
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
    /**
     * GET /organizations/:orgId/teams/:teamId/projects/:projectId/tasks?tags=bug,frontend&tagsMode=any
     * GET /organizations/:orgId/teams/:teamId/projects/:projectId/tasks?tags=bug,urgent&tagsMode=all
     * GET /organizations/:orgId/teams/:teamId/projects/:projectId/tasks?untaggedOnly=true
     */
    return this.tasksService.listTasks(orgId, teamId, projectId, dto, actorId);
  }

  @Get('search')
  @ResponseMessage('Search results fetched successfully.')
  @ApiOperation({ summary: 'Full-text search tasks by title/description' })
  @ApiPaginatedDataResponse(TaskDto, 'Search results fetched successfully.')
  @ApiErrorResponses(401, 403, 404)
  async searchTasks(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() dto: SearchTasksDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.searchTasks(orgId, teamId, projectId, dto, actorId);
  }

  @Get(':id')
  @Cache(60, (req) => [
    CacheTags.task(requireParam(req, 'id')),
    CacheTags.project(requireParam(req, 'projectId')),
    CacheTags.team(requireParam(req, 'teamId')),
  ])
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

  @Patch(':id')
  @ResponseMessage('Task updated successfully.')
  @ApiOperation({ summary: 'Update a task (fields, assignee, or status)' })
  @ApiDataResponse(TaskDto, 'Task updated successfully.')
  @ApiErrorResponses(401, 403, 404, 409, 422)
  async updateTask(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.updateTask(id, projectId, teamId, orgId, dto, actorId);
  }

  @Patch(':id/status')
  @ResponseMessage('Task status updated successfully.')
  @ApiOperation({ summary: 'Update a task status' })
  @ApiDataResponse(TaskDto, 'Task status updated successfully.')
  @ApiErrorResponses(401, 403, 404, 409, 422)
  async updateStatus(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.updateStatus(id, projectId, teamId, orgId, dto, actorId);
  }

  @Delete(':id')
  @ResponseMessage('Task deleted successfully.')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiMessageResponse('Task deleted successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404, 409)
  async deleteTask(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.softDeleteTask(id, projectId, teamId, orgId, actorId);
  }

  @Patch(':id/tags')
  @ResponseMessage('Tags added successfully.')
  @ApiOperation({ summary: 'Add one or more tags to a task' })
  @ApiDataResponse(TaskDto, 'Tags added successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
  async addTags(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskTagsDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.addTags(id, projectId, teamId, orgId, dto, actorId);
  }

  @Delete(':id/tags')
  @ResponseMessage('Tags removed successfully.')
  @ApiOperation({ summary: 'Remove one or more tags from a task' })
  @ApiDataResponse(TaskDto, 'Tags removed successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404, 409)
  async removeTags(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskTagsDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.removeTags(id, projectId, teamId, orgId, dto, actorId);
  }

  @Post(':id/watch')
  @ResponseMessage('Task watched successfully.')
  @ApiMessageResponse('Task watched successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404, 409)
  async watchTask(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.watchTask(id, projectId, teamId, orgId, actorId);
  }

  @Delete(':id/watch')
  @ResponseMessage('Task unwatched successfully.')
  @ApiMessageResponse('Task unwatched successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404, 409)
  async unwatchTask(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.tasksService.unwatchTask(id, projectId, teamId, orgId, actorId);
  }

  @Post(':id/attachments')
  @ResponseMessage('Attachments uploaded successfully.')
  @ApiOperation({ summary: 'Upload attachments to a task' })
  @ApiDataResponse(AttachmentUploadResultDto, 'Attachments processed.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404, 409)
  @UseInterceptors(FilesInterceptor('files'))
  async uploadAttachment(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /^(image\/(jpeg|png|gif)|application\/pdf|text\/plain|application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|msword))$/,
          }),
        ],
      }),
    )
    files: Express.Multer.File[],
    @CurrentUser('sub') userId: string,
  ) {
    const fileList = Array.isArray(files) ? files : [files];

    const results = await Promise.allSettled(
      fileList.map((file) =>
        this.tasksService.addAttachments(id, orgId, teamId, projectId, file, userId),
      ),
    );

    const succeeded: AttachmentEntity[] = [];
    const failed: { filename: string; reason: string }[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeeded.push(result.value);
      } else {
        failed.push({
          filename: fileList[i].originalname,
          reason: result.reason instanceof Error ? result.reason.message : 'Upload failed',
        });
      }
    });

    return { succeeded, failed };
  }
}
