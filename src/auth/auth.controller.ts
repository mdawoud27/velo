import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegistrationDto,
  ResendEmailDto,
  ResetPassword,
  VerifyEmailDto,
  AuthTokensDto,
} from './dtos';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import { CurrentUser, Public } from './decorators';
import { JwtPayload } from './interfaces';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiMessageResponse,
  ResponseMessage,
} from 'src/common/decorators';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Check your inbox to verify your email')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiMessageResponse('Check your inbox to verify your email', HttpStatus.CREATED)
  @ApiErrorResponses(409)
  async register(@Body() dto: RegistrationDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiMessageResponse('If that account needs verification, a new email has been sent.')
  async resendVerificationEmail(@Body() dto: ResendEmailDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiMessageResponse('Email verified successfully')
  @ApiErrorResponses(400)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User logged in successfully')
  @ApiOperation({ summary: 'User login' })
  @ApiDataResponse(AuthTokensDto, 'User logged in successfully')
  @ApiErrorResponses(401, 403)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('New tokens generated successfully')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiDataResponse(AuthTokensDto, 'New tokens generated successfully')
  @ApiErrorResponses(400, 401, 403)
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forgot password' })
  @ApiMessageResponse('If that account exists, a reset link has been sent')
  @ApiErrorResponses(403)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset successfully')
  @ApiOperation({ summary: 'Reset password' })
  @ApiMessageResponse('Password reset successfully')
  @ApiErrorResponses(400, 403)
  async resetPassword(@Body() dto: ResetPassword) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('You are logged out successfully')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'User logout' })
  @ApiMessageResponse('You are logged out successfully')
  @ApiErrorResponses(401)
  async logout(@CurrentUser() user: JwtPayload & { exp: number }) {
    return this.authService.logout(user);
  }
}
