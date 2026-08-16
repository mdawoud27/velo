import { sanitizeFilename } from './sanitize-filename';

describe('sanitizeFilename', () => {
  it('leaves a clean alphanumeric name unchanged', () => {
    expect(sanitizeFilename('report')).toBe('report');
  });

  it('preserves dots, hyphens and underscores', () => {
    expect(sanitizeFilename('my_report-2024.xlsx')).toBe('my_report-2024.xlsx');
  });

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('my report')).toBe('my-report');
  });

  it('replaces special characters with hyphens', () => {
    expect(sanitizeFilename('report@2024!')).toBe('report-2024');
  });

  it('collapses consecutive hyphens into one', () => {
    expect(sanitizeFilename('hello   world')).toBe('hello-world');
  });

  it('strips leading hyphens', () => {
    expect(sanitizeFilename('  hello')).toBe('hello');
  });

  it('strips trailing hyphens', () => {
    expect(sanitizeFilename('hello  ')).toBe('hello');
  });

  it('strips both leading and trailing hyphens after replacement', () => {
    expect(sanitizeFilename('  hello world  ')).toBe('hello-world');
  });

  it('truncates names longer than 80 characters', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeFilename(long)).toHaveLength(80);
  });

  it('returns empty string for an all-special-character input', () => {
    expect(sanitizeFilename('!!!@@@###')).toBe('');
  });

  it('handles an empty string input', () => {
    expect(sanitizeFilename('')).toBe('');
  });

  it('handles a realistic export filename', () => {
    const result = sanitizeFilename('Tasks Export — Q1 2024 (Final).xlsx');
    expect(result).not.toContain(' ');
    expect(result).not.toContain('—');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
    expect(result.length).toBeLessThanOrEqual(80);
  });
});
