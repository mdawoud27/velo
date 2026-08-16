import { MailHandlebarsAdapter } from './mail-handlebars.adapter';

function makeLogger() {
  return { warn: jest.fn() } as any;
}

describe('MailHandlebarsAdapter', () => {
  it('instantiates cleanly and logs warning when partials directory is missing/empty', () => {
    const logger = makeLogger();
    const adapter = new MailHandlebarsAdapter('/non-existent-dir', logger);
    expect(adapter).toBeDefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No partials found at /non-existent-dir'),
    );
  });
});
