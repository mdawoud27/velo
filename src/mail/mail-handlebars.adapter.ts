import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { MailerOptions } from '@nestjs-modules/mailer';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';

interface HandlebarsInstance {
  registerPartial(name: string, partial: string): void;
}

interface HandlebarsAdapterInternal {
  handlebarsInstance: HandlebarsInstance;
}

type CompileCallback = (err?: Error | null, body?: string) => void;

export class MailHandlebarsAdapter extends HandlebarsAdapter {
  private readonly partials: Array<{ name: string; content: string }>;

  constructor(partialsDir: string) {
    super();
    this.partials = existsSync(partialsDir)
      ? readdirSync(partialsDir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => ({
            name: basename(entry.name, extname(entry.name)),
            content: readFileSync(join(partialsDir, entry.name), 'utf-8'),
          }))
      : [];
  }

  override compile(mail: unknown, callback: CompileCallback, mailerConfig: MailerOptions) {
    const { handlebarsInstance } = this as unknown as HandlebarsAdapterInternal;

    if (handlebarsInstance) {
      for (const { name, content } of this.partials) {
        handlebarsInstance.registerPartial(name, content);
      }
    }

    super.compile(mail, callback, mailerConfig);
  }
}
