import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  AcceptInviteDto,
  BulkInviteDto,
  CreateOrganizationDto,
  DeclineInviteDto,
  InviteDto,
  OrgDto,
} from './dtos';
import { CurrentUser, Roles } from 'src/auth/decorators';
import { RolesGuard } from 'src/auth/guards';
import { OrgRole } from '@prisma/client';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { PaginationDto } from 'src/common/dtos';
import { Cache } from 'src/cache/decorators';
import { requireParam, requireUser } from 'src/cache/utils';
import { Idempotent } from 'src/idempotency/decorators';
import { CacheTags } from 'src/cache/constants';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  @Idempotent(60 * 60 * 24)
  @ResponseMessage('Organization created successfully.')
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiDataResponse(OrgDto, 'Organization created successfully.')
  @ApiErrorResponses(401, 404, 409)
  async createOrganization(@Body() dto: CreateOrganizationDto, @CurrentUser('sub') userId: string) {
    return this.orgService.createOrganization(dto, userId);
  }

  @Post(':orgId/invite')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(RolesGuard)
  @Idempotent(60 * 60 * 24)
  @ResponseMessage('Invitation sent successfully.')
  @ApiOperation({ summary: 'Invite a new member to the organization.' })
  @ApiMessageResponse('Invitation sent successfully.', 201)
  @ApiErrorResponses(401, 403, 404, 409)
  async inviteMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: InviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.inviteMember(orgId, dto, userId);
  }

  @Post(':orgId/invitations/bulk')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(RolesGuard)
  @Idempotent(60 * 60 * 24)
  @ResponseMessage('Bulk invitations processed.')
  @ApiOperation({ summary: 'Invite multiple members to the organization in bulk.' })
  @ApiDataResponse(Object, 'Bulk invitations processed.')
  @ApiErrorResponses(401, 403, 404)
  async bulkInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: BulkInviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.bulkInviteMembers(orgId, dto, userId);
  }

  @Post(':orgId/resend')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(RolesGuard)
  @ResponseMessage('Invitation resent successfully.')
  @ApiOperation({ summary: 'Resend an invitation to the organization.' })
  @ApiMessageResponse('Invitation resent successfully.', 201)
  @ApiErrorResponses(401, 403, 404, 409)
  async resendInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: InviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.resendInvite(orgId, dto, userId);
  }

  @Post(':orgId/accept')
  @ResponseMessage('Invitation accepted successfully.')
  @ApiOperation({ summary: 'Accept an invitation to the organization.' })
  @ApiMessageResponse('Invitation accepted successfully.')
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 404, 409)
  async acceptInvitation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: AcceptInviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.acceptInvitation(orgId, dto, userId);
  }

  @Post(':orgId/decline')
  @ResponseMessage('Invitation declined successfully.')
  @ApiOperation({ summary: 'Decline an invitation to the organization.' })
  @ApiMessageResponse('Invitation declined successfully.', 204)
  @HttpCode(HttpStatus.OK)
  @ApiErrorResponses(401, 404, 409)
  async declineInvitation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: DeclineInviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.declineInvitation(orgId, dto, userId);
  }

  @Get(':orgId/invitations')
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(RolesGuard)
  @Cache(15, (req) => [CacheTags.org(requireParam(req, 'orgId'))])
  @ResponseMessage('Invitations listed successfully.')
  @ApiOperation({ summary: 'List invitations to the organization.' })
  @ApiPaginatedDataResponse(OrgDto, 'Invitations listed successfully.')
  @ApiErrorResponses(401, 403, 404, 409)
  async listInvitations(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser('sub') userId: string,
    @Query() dto: PaginationDto,
  ) {
    return this.orgService.listInvitations(orgId, userId, dto);
  }

  @Get('me')
  @Cache(15, (req) => [CacheTags.user(requireUser(req).sub)])
  @ResponseMessage('Organizations listed successfully.')
  @ApiOperation({ summary: 'List organizations the current user belongs to.' })
  @ApiPaginatedDataResponse(OrgDto, 'Organizations listed successfully.')
  @ApiErrorResponses(401)
  async getUserOrgs(@CurrentUser('sub') userId: string, @Query() dto: PaginationDto) {
    return this.orgService.getUserOrgs(userId, dto);
  }
}
