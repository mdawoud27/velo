import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { join } from 'path';

@ApiTags('Home')
@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }

  @Get()
  home(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'public', 'index.html'));
  }
}
