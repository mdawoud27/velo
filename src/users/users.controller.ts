import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators';
import type { JwtPayload } from 'src/auth/interfaces';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { NotifPreferencesDto, UpdateAccountDto, UpdatePasswordDto, UserDto } from './dtos';
import type { UploadedFile as UploadedFileType } from './types';
import { UsersService } from './users.service';
import { Cache } from 'src/cache/decorators';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_MIME_TYPE = /^image\/(jpeg|png|gif|webp)$/;

type AccessPayload = JwtPayload & { exp?: number };

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Cache(60)
  @ResponseMessage('User fetched successfully')
  @ApiOperation({ summary: 'Get current user' })
  @ApiDataResponse(UserDto, 'User fetched successfully')
  @ApiErrorResponses(401, 404)
  getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me')
  @ResponseMessage('User updated successfully')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiDataResponse(UserDto, 'User updated successfully')
  @ApiErrorResponses(400, 401, 404)
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateAccountDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Get('me/notification-preferences')
  @ResponseMessage('Notification preferences retrieved successfully')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiDataResponse(NotifPreferencesDto, 'Notification preferences')
  @ApiErrorResponses(401)
  getNotifPreferences(@CurrentUser('sub') userId: string) {
    return this.usersService.getNotifPreferences(userId);
  }

  @Patch('me/notification-preferences')
  @ResponseMessage('Notification preferences updated successfully')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiDataResponse(NotifPreferencesDto, 'Notification preferences updated successfully')
  @ApiErrorResponses(400, 401)
  updateNotifPreferences(@CurrentUser('sub') userId: string, @Body() dto: NotifPreferencesDto) {
    return this.usersService.updateNotifPreferences(userId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated successfully')
  @ApiOperation({ summary: 'Update password' })
  @ApiMessageResponse('Password updated successfully')
  @ApiErrorResponses(400, 401, 404)
  updatePassword(@CurrentUser() user: AccessPayload, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(user, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Account deleted successfully')
  @ApiOperation({ summary: 'Soft delete account' })
  @ApiMessageResponse('Account deleted successfully')
  @ApiErrorResponses(401, 404)
  deleteMe(@CurrentUser() user: AccessPayload) {
    return this.usersService.softDeleteMe(user);
  }

  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
      fileFilter: (_req, file, callback) => {
        if (AVATAR_MIME_TYPE.test(file.mimetype)) {
          callback(null, true);
          return;
        }
        callback(new BadRequestException(`File type ${file.mimetype} is not allowed.`), false);
      },
    }),
  )
  @ResponseMessage('Avatar uploaded successfully')
  @ApiOperation({ summary: 'Upload avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'jpeg / png / gif / webp — max 5 MB',
        },
      },
    },
  })
  @ApiDataResponse(UserDto, 'Avatar uploaded successfully')
  @ApiErrorResponses(400, 401, 404)
  uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AVATAR_SIZE }),
          new FileTypeValidator({ fileType: AVATAR_MIME_TYPE }),
        ],
      }),
    )
    file: UploadedFileType,
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Avatar deleted successfully')
  @ApiOperation({ summary: 'Delete avatar' })
  @ApiMessageResponse('Avatar deleted successfully')
  @ApiErrorResponses(401, 404)
  deleteAvatar(@CurrentUser('sub') userId: string) {
    return this.usersService.deleteAvatar(userId);
  }
}
