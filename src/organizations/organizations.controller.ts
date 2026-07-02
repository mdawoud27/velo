import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, OrgDto } from './dtos';
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
    return this.orgService.createOrgainzation(dto, userId);
  }
}
