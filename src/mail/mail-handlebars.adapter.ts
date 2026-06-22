import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import * as handlebars from 'handlebars';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { LoggerService } from 'src/logger/logger.service';

export class MailHandlebarsAdapter extends HandlebarsAdapter {
  constructor(
    private readonly partialsDir: string,
    private readonly logger: LoggerService,
  ) {
    super();

    const partials = existsSync(this.partialsDir)
      ? readdirSync(this.partialsDir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => ({
            name: basename(entry.name, extname(entry.name)),
            content: readFileSync(join(this.partialsDir, entry.name), 'utf-8'),
          }))
      : [];

    if (partials.length === 0) {
      this.logger.warn(`[MailHandlebarsAdapter] No partials found at ${this.partialsDir}`);
    }

    for (const { name, content } of partials) {
      handlebars.registerPartial(name, content);
    }
  }
}
