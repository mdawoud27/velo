import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { readFileSync } from 'fs';
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
  serveRoot(@Res() res: Response) {
    const { version } = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version: string;
    };

    const html = readFileSync(join(process.cwd(), 'public', 'index.html'), 'utf8').replace(
      '{{VERSION}}',
      version,
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
