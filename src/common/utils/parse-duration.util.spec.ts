import { parseDurationToSeconds } from './parse-duration.util';

describe('parseDurationToSeconds', () => {
  it('parses plain numeric string as seconds', () => {
    expect(parseDurationToSeconds('900')).toBe(900);
  });

  it('parses seconds unit', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
  });

  it('parses minutes unit', () => {
    expect(parseDurationToSeconds('15m')).toBe(900);
  });

  it('parses hours unit', () => {
    expect(parseDurationToSeconds('2h')).toBe(7200);
  });

  it('parses days unit', () => {
    expect(parseDurationToSeconds('7d')).toBe(604800);
  });

  it('parses weeks unit', () => {
    expect(parseDurationToSeconds('1w')).toBe(604800);
  });

  it('trims whitespace before parsing', () => {
    expect(parseDurationToSeconds('  15m  ')).toBe(900);
  });

  it('throws on invalid format', () => {
    expect(() => parseDurationToSeconds('abc')).toThrow(/Invalid duration/);
  });

  it('throws on unsupported unit', () => {
    expect(() => parseDurationToSeconds('10y')).toThrow(/Invalid duration/);
  });

  it('throws on empty string', () => {
    expect(() => parseDurationToSeconds('')).toThrow(/Invalid duration/);
  });
});
