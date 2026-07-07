import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { CreateProjectDto, ListProjectsDto, ProjectDto, UpdateProjectDto } from './dtos';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('organizations/:orgId/teams/:teamId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ResponseMessage('Project created successfully.')
  @ApiOperation({ summary: 'Create a new project' })
  @ApiDataResponse(ProjectDto, 'Project created successfully.')
  @ApiErrorResponses(401, 403, 404)
  async createProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: CreateProjectDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.projectsService.createProject(orgId, teamId, dto, actorId);
  }

  @Get()
  @ResponseMessage('Projects listed successfully.')
  @ApiOperation({ summary: 'List all projects in a team' })
  @ApiPaginatedDataResponse(ProjectDto, 'Projects listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listProjects(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() dto: ListProjectsDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.projectsService.listProjects(orgId, teamId, dto, actorId);
  }

  @Get(':id')
  @ResponseMessage('Project fetched successfully.')
  @ApiOperation({ summary: 'Get project details' })
  @ApiDataResponse(ProjectDto, 'Project fetched successfully.')
  @ApiErrorResponses(401, 403, 404)
  async getProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.projectsService.getProject(id, teamId, orgId, actorId);
  }

  @Patch(':id')
  @ResponseMessage('Project updated successfully.')
  @ApiOperation({ summary: 'Update project details' })
  @ApiDataResponse(ProjectDto, 'Project updated successfully.')
  @ApiErrorResponses(401, 403, 404)
  async updateProject(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.projectsService.updateProject(id, teamId, orgId, dto, actorId);
  }
}
