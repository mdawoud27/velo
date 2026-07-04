import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { AcceptInviteDto, CreateOrganizationDto, InviteDto, OrgDto } from './dtos';
import { CurrentUser } from 'src/auth/decorators';
import { ApiDataResponse, ApiErrorResponses, ResponseMessage } from 'src/common/decorators';

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
  @ApiDataResponse(OrgDto, 'Invitation sent successfully.')
  @ApiErrorResponses(401, 404, 409)
  async inviteMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: InviteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.orgService.inviteMember(orgId, dto, userId);
  }

  @Post(':orgId/accept')
  @ResponseMessage('Invitation accepted successfully.')
  @ApiOperation({ summary: 'Accept an invitation to the organization.' })
  @ApiDataResponse(OrgDto, 'Invitation accepted successfully.')
  @ApiErrorResponses(401, 404, 409)
  async acceptInvitation(@Body() dto: AcceptInviteDto, @CurrentUser('sub') userId: string) {
    return this.orgService.acceptInvitation(dto, userId);
  }

  @Post(':orgId/decline')
  @ResponseMessage('Invitation declined successfully.')
  @ApiOperation({ summary: 'Decline an invitation to the organization.' })
  @ApiDataResponse(OrgDto, 'Invitation declined successfully.')
  @ApiErrorResponses(401, 404, 409)
  async declineInvitation(@Body() dto: AcceptInviteDto, @CurrentUser('sub') userId: string) {
    return this.orgService.declineInvitation(dto, userId);
  }
}
