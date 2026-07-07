import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators';
import { ApiDataResponse, ApiErrorResponses, ResponseMessage } from 'src/common/decorators';
import { CreateProjectDto, ProjectDto } from './dtos';
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
}
