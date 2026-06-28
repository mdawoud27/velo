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
import { CurrentUser } from 'src/auth/decorators';
import type { JwtPayload } from 'src/auth/interfaces';
import { NotifPreferencesDto, UpdateAccountDto, UpdatePasswordDto } from './dtos';
import type { UploadedFile as UploadedFileType } from './types';
import { UsersService } from './users.service';
import { ResponseMessage } from 'src/common/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_MIME_TYPE = /^image\/(jpeg|png|gif|webp)$/;

type AccessPayload = JwtPayload & { exp?: number };

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the profile information of the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'User fetched successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Get('me')
  @ResponseMessage('User fetched successfully')
  getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findMe(userId);
  }

  @ApiOperation({
    summary: 'Update user profile',
    description: 'Updates the profile information of the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Patch('me')
  @ResponseMessage('User updated successfully')
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateAccountDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Updates the notification preferences of the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Notification preferences updated successfully' })
  @Patch('me/notification-preferences')
  @ResponseMessage('Notification preferences updated successfully')
  updateNotifPreferences(@CurrentUser('sub') userId: string, @Body() dto: NotifPreferencesDto) {
    return this.usersService.updateNotifPreferences(userId, dto);
  }

  @ApiOperation({
    summary: 'Update current user password',
    description: 'Updates the password of the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'This account does not have a password to update.' })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated successfully')
  updatePassword(@CurrentUser() user: AccessPayload, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(user, dto);
  }

  @ApiOperation({
    summary: 'Soft delete current user account',
    description: 'Deletes the currently authenticated user account in a soft manner.',
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Account deleted successfully')
  deleteMe(@CurrentUser() user: AccessPayload) {
    return this.usersService.softDeleteMe(user);
  }

  @ApiOperation({
    summary: 'Upload avatar for current user',
    description:
      'Uploads a new avatar for the currently authenticated user. The previous avatar is deleted.',
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
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

  @ApiOperation({
    summary: 'Delete avatar for current user',
    description: 'Deletes the avatar of the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Avatar deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @Delete('me/avatar')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Avatar deleted successfully')
  deleteAvatar(@CurrentUser('sub') userId: string) {
    return this.usersService.deleteAvatar(userId);
  }
}
