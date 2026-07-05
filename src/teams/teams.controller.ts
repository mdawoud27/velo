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
import type { JwtPayload } from 'src/auth/interfaces';
import { OrgRole } from '@prisma/client';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('organizations/:orgId/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @ResponseMessage('Team created successfully.')
  @ApiOperation({ summary: 'Create a new team' })
  @ApiDataResponse(TeamDto, 'Team created successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
  async createTeam(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateTeamDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.createTeam(orgId, dto, userId);
  }

  @Get()
  @ResponseMessage('Teams listed successfully.')
  @ApiOperation({ summary: 'List all teams in organization' })
  @ApiPaginatedDataResponse(TeamDto, 'Teams listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listTeams(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() dto: PaginationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.listTeams(orgId, dto, userId);
  }

  @Get(':id')
  @ResponseMessage('Team fetched successfully.')
  @ApiOperation({ summary: 'Get team details' })
  @ApiDataResponse(TeamDto, 'Team fetched successfully.')
  @ApiErrorResponses(401, 403, 404)
  async getTeam(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.getTeam(id, orgId, userId);
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
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.updateTeam(id, orgId, dto, userId);
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
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.softDeleteTeam(id, orgId, userId);
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
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.addMember(id, orgId, dto, userId);
  }

  @Get(':id/members')
  @ResponseMessage('Team members listed successfully.')
  @ApiOperation({ summary: 'List team members' })
  @ApiPaginatedDataResponse(TeamMemberDto, 'Team members listed successfully.')
  @ApiErrorResponses(401, 403, 404)
  async listMembers(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginationDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.teamsService.listMembers(id, orgId, dto, userId);
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
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.updateMemberRole(id, orgId, userId, dto, user.sub);
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
    @CurrentUser() user: JwtPayload,
  ) {
    return this.teamsService.removeMember(id, orgId, userId, user.sub);
  }
}
