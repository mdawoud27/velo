import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegistrationDto,
  ResendEmailDto,
  ResetPassword,
  VerifyEmailDto,
} from './dtos';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import { CurrentUser, Public } from './decorators';
import { JwtPayload } from './interfaces';
import { ResponseMessage } from 'src/common/decorators';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user', description: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'Check your inbox to verify your email' })
  @ApiResponse({ status: 409, description: 'Email is already registered.' })
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Check your inbox to verify your email')
  async register(@Body() dto: RegistrationDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Resend verification email', description: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'If that account needs verification, a new email has been sent.',
  })
  @Public()
  @Post('resend-verification-email')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(@Body() dto: ResendEmailDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @ApiOperation({ summary: 'Verify user email', description: 'Verify user email' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'This token is invalid or has expired.' })
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @ApiOperation({ summary: 'User login', description: 'User login' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password.' })
  @ApiResponse({ status: 403, description: 'Email is not verified.' })
  @ApiResponse({ status: 403, description: 'Your account has been suspended.' })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User logged in successfully')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Refresh access token', description: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New tokens generated successfully' })
  @ApiResponse({ status: 400, description: 'This token is invalid or has expired.' })
  @ApiResponse({ status: 401, description: 'Session expired. Please log in again.' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token. Please log in again.' })
  @ApiResponse({ status: 401, description: 'Refresh token already used. Please retry.' })
  @ApiResponse({ status: 403, description: 'Email is not verified.' })
  @ApiResponse({ status: 403, description: 'Your account has been deactivated.' })
  @ApiResponse({ status: 403, description: 'Your account has been suspended.' })
  @Public()
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('New tokens generated successfully')
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @ApiOperation({ summary: 'Forgot password', description: 'Forgot password' })
  @ApiResponse({ status: 200, description: 'If that account exists, a reset link has been sent' })
  @ApiResponse({ status: 403, description: 'Email is not verified.' })
  @ApiResponse({ status: 403, description: 'Your account has been suspended.' })
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({ summary: 'Reset password', description: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'This token is invalid or has expired.' })
  @ApiResponse({ status: 403, description: 'Your account has been deactivated.' })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset successfully')
  async resetPassword(@Body() dto: ResetPassword) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({ summary: 'User logout', description: 'User logout' })
  @ApiResponse({ status: 200, description: 'You are logged out successfully' })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('You are logged out successfully')
  async logout(@CurrentUser() user: JwtPayload & { exp: number }) {
    return this.authService.logout(user);
  }
}
