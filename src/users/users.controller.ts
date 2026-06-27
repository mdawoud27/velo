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

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_MIME_TYPE = /^image\/(jpeg|png|gif|webp)$/;

type AccessPayload = JwtPayload & { exp?: number };

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ResponseMessage('User fetched successfully')
  getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findMe(userId);
  }

  @Patch('me')
  @ResponseMessage('User updated successfully')
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateAccountDto) {
    return this.usersService.updateMe(userId, dto);
  }

  @Patch('me/notification-preferences')
  @ResponseMessage('Notification preferences updated successfully')
  updateNotifPreferences(@CurrentUser('sub') userId: string, @Body() dto: NotifPreferencesDto) {
    return this.usersService.updateNotifPreferences(userId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password updated successfully')
  updatePassword(@CurrentUser() user: AccessPayload, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(user, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Account deleted successfully')
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
  deleteAvatar(@CurrentUser('sub') userId: string) {
    return this.usersService.deleteAvatar(userId);
  }
}
