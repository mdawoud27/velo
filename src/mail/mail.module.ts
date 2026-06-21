import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailHandlebarsAdapter } from './mail-handlebars.adapter';
import { MailService } from './mail.service';
import { LoggerService } from 'src/logger/logger.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: (logger: LoggerService, config: ConfigService) => ({
        transport: {
          host: config.getOrThrow<string>('SMTP_HOST'),
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get('SMTP_SECURE', false) === 'true',
          auth: {
            user: config.getOrThrow<string>('SMTP_USER'),
            pass: config.getOrThrow<string>('SMTP_PASS'),
          },
        },
        defaults: {
          from: config.get<string>('EMAIL_FROM', '"No Reply" <noreply@velo.com>'),
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new MailHandlebarsAdapter(join(__dirname, 'templates', 'partials'), logger),
          options: { strict: true },
        },
      }),
      inject: [LoggerService, ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
