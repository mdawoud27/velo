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
import { TeamsService } from './teams.service';
import {
  AddTeamMemberDto,
  CreateTeamDto,
  TeamDto,
  TeamMemberDto,
  UpdateTeamDto,
  UpdateTeamMemberRoleDto,
} from './dtos';
import { CurrentUser, Roles } from 'src/auth/decorators';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { PaginationDto } from 'src/common/dtos';
import { OrgRole } from '@prisma/client';
import { TeamMemberWithUserEntity } from './entities';
import { Cache } from 'src/cache/decorators';
import { CacheTags, requireParam } from 'src/cache/utils';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('organizations/:orgId/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ResponseMessage('Team created successfully.')
  @ApiOperation({ summary: 'Create a new team' })
  @ApiDataResponse(TeamDto, 'Team created successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
  async createTeam(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateTeamDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.createTeam(orgId, dto, actorId);
  }

  @Get()
  @Cache(30, (req) => [CacheTags.org(requireParam(req, 'orgId'))])
  @ResponseMessage('Teams listed successfully.')
  @ApiOperation({ summary: 'List all teams in organization' })
  @ApiPaginatedDataResponse(TeamDto, 'Teams listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listTeams(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() dto: PaginationDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.listTeams(orgId, dto, actorId);
  }

  @Get(':id')
  @Cache(60, (req) => [CacheTags.team(requireParam(req, 'id'))])
  @ResponseMessage('Team fetched successfully.')
  @ApiOperation({ summary: 'Get team details' })
  @ApiDataResponse(TeamDto, 'Team fetched successfully.')
  @ApiErrorResponses(401, 403, 404)
  async getTeam(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.getTeam(id, orgId, actorId);
  }

  @Patch(':id')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ResponseMessage('Team updated successfully.')
  @ApiOperation({ summary: 'Update team details' })
  @ApiDataResponse(TeamDto, 'Team updated successfully.')
  @ApiErrorResponses(401, 403, 404)
  async updateTeam(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.updateTeam(id, orgId, dto, actorId);
  }

  @Delete(':id')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ResponseMessage('Team deleted successfully.')
  @ApiOperation({ summary: 'Delete a team' })
  @ApiMessageResponse('Team deleted successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404)
  async deleteTeam(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.softDeleteTeam(id, orgId, actorId);
  }

  @Post(':id/members')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ResponseMessage('Team member added successfully.')
  @ApiOperation({ summary: 'Add a user to the team' })
  @ApiDataResponse(TeamMemberDto, 'Team member added successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
  async addMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.addMember(id, orgId, dto, actorId);
  }

  @Get(':id/members')
  @Cache(30, (req) => [CacheTags.team(requireParam(req, 'id'))])
  @ResponseMessage('Team members listed successfully.')
  @ApiOperation({ summary: 'List team members' })
  @ApiPaginatedDataResponse(TeamMemberWithUserEntity, 'Team members listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listMembers(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginationDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.listMembers(id, orgId, dto, actorId);
  }

  @Patch(':id/members/:userId')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ResponseMessage('Team member role updated successfully.')
  @ApiOperation({ summary: 'Update team member role' })
  @ApiDataResponse(TeamMemberDto, 'Team member role updated successfully.')
  @ApiErrorResponses(401, 403, 404)
  async updateMemberRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateTeamMemberRoleDto,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.updateMemberRole(id, orgId, userId, dto, actorId);
  }

  @Delete(':id/members/:userId')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ResponseMessage('Team member removed successfully.')
  @ApiOperation({ summary: 'Remove a user from the team' })
  @ApiMessageResponse('Team member removed successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 403, 404)
  async removeMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.teamsService.removeMember(id, orgId, userId, actorId);
  }
}
