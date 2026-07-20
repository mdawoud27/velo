import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { CommentDto, CreateCommentDto, UpdateCommentDto } from './dtos';
import { CurrentUser } from 'src/auth/decorators';
import { PaginationDto } from 'src/common/dtos';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('organizations/:orgId/teams/:teamId/projects/:projectId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ResponseMessage('Comment created successfully.')
  @ApiOperation({ summary: 'Create a new comment' })
  @ApiDataResponse(CommentDto, 'Comment created successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
  async createComment(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.commentsService.createComment(orgId, teamId, projectId, taskId, dto, actorId);
  }

  @Get()
  @ResponseMessage('Comments listed successfully.')
  @ApiOperation({ summary: 'List comments for a task' })
  @ApiPaginatedDataResponse(CommentDto, 'Comments listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listComments(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() dto: PaginationDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.commentsService.listComments(orgId, teamId, projectId, taskId, dto, actorId);
  }

  @Patch(':id')
  @ResponseMessage('Comment updated successfully.')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiDataResponse(CommentDto, 'Comment updated successfully.')
  @ApiErrorResponses(401, 403, 404, 409, 422)
  async updateComment(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.commentsService.updateComment(orgId, teamId, projectId, taskId, id, dto, actorId);
  }

  @Delete(':id')
  @ResponseMessage('Comment deleted successfully.')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiMessageResponse('Comment deleted successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404, 409)
  async deleteComment(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.commentsService.deleteComment(orgId, teamId, projectId, taskId, id, actorId);
  }
}
