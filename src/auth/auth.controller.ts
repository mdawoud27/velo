import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RegistrationDto } from './dtos/registration.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegistrationDto) {
    return this.authService.register(dto);
  }
}
