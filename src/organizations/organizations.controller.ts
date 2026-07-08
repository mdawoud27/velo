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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  AcceptInviteDto,
  CreateOrganizationDto,
  DeclineInviteDto,
  InviteDto,
  OrgDto,
} from './dtos';
import { CurrentUser } from 'src/auth/decorators';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ApiPaginatedDataResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { PaginationDto } from 'src/common/dtos';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgService: OrganizationsService) {}

  @Post()
  @ResponseMessage('Organization created successfully.')
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiDataResponse(OrgDto, 'Organization created successfully.')
  @ApiErrorResponses(401, 404, 409)
  async createOrganization(@Body() dto: CreateOrganizationDto, @CurrentUser('sub') userId: string) {
    return this.orgService.createOrganization(dto, userId);
  }

  @Post(':orgId/invite')
  @ResponseMessage('Invitation sent successfully.')
  @ApiOperation({ summary: 'Invite a new member to the organization.' })
  @ApiMessageResponse('Invitation sent successfully.', 201)
  @ApiErrorResponses(401, 404, 409)
  async inviteMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: InviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.inviteMember(orgId, dto, userId);
  }

  @Post(':orgId/resend')
  @ResponseMessage('Invitation resent successfully.')
  @ApiOperation({ summary: 'Resend an invitation to the organization.' })
  @ApiMessageResponse('Invitation resent successfully.', 201)
  @ApiErrorResponses(401, 404, 409)
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
  @ResponseMessage('Invitations listed successfully.')
  @ApiOperation({ summary: 'List invitations to the organization.' })
  @ApiPaginatedDataResponse(OrgDto, 'Invitations listed successfully.')
  @ApiErrorResponses(401, 404, 409)
  async listInvitations(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser('sub') userId: string,
    @Query() dto: PaginationDto,
  ) {
    return this.orgService.listInvitations(orgId, userId, dto);
  }
}
