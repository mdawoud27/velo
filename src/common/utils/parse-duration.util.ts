const UNIT_MAP: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

export function parseDurationToSeconds(value: string): number {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  const match = trimmed.match(/^(\d+)([smhdw])$/);
  if (!match) {
    throw new Error(
      `Invalid duration "${value}". Use plain seconds (e.g. 900) or a unit string (e.g. 15m, 7d).`,
    );
  }

  return parseInt(match[1], 10) * UNIT_MAP[match[2]];
}
