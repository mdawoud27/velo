import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { MailService } from './mail.service';

interface HandlebarsInstance {
  registerPartial(name: string, partial: string): void;
}

interface HandlebarsAdapterInternal {
  handlebars: HandlebarsInstance;
}

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const adapter = new HandlebarsAdapter();
        const partialsDir = join(__dirname, 'templates', 'partials');

        if (existsSync(partialsDir)) {
          const hbs = (adapter as unknown as HandlebarsAdapterInternal).handlebars;
          readdirSync(partialsDir).forEach((file) => {
            hbs.registerPartial(
              basename(file, extname(file)),
              readFileSync(join(partialsDir, file), 'utf-8'),
            );
          });
        }

        return {
          transport: {
            host: config.getOrThrow<string>('MAIL_HOST'),
            port: config.get<number>('MAIL_PORT', 587),
            secure: config.get<boolean>('MAIL_SECURE', false),
            auth: {
              user: config.getOrThrow<string>('MAIL_USER'),
              pass: config.getOrThrow<string>('MAIL_PASS'),
            },
          },
          defaults: {
            from: config.get<string>('MAIL_FROM', '"No Reply" <noreply@velo.com>'),
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter,
            options: { strict: true },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
