import { Store } from 'express-session';
import type { SessionData } from 'express-session';
import { RedisService } from 'src/redis/redis.service';

export class RedisSessionStore extends Store {
  private readonly PREFIX = 'sess:';
  private readonly DEFAULT_TTL = 600;

  constructor(private readonly redis: RedisService) {
    super();
  }

  get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    this.redis
      .get(this.PREFIX + sid)
      .then((data) => cb(null, data ? (JSON.parse(data) as SessionData) : null))
      .catch((err: unknown) => cb(err));
  }

  set(sid: string, session: SessionData, cb?: (err?: unknown) => void): void {
    const ttl = session.cookie.maxAge ? Math.ceil(session.cookie.maxAge / 1000) : this.DEFAULT_TTL;

    this.redis
      .setex(this.PREFIX + sid, JSON.stringify(session), ttl)
      .then(() => cb?.())
      .catch((err: unknown) => cb?.(err));
  }

  destroy(sid: string, cb?: (err?: unknown) => void): void {
    this.redis
      .del(this.PREFIX + sid)
      .then(() => cb?.())
      .catch((err: unknown) => cb?.(err));
  }
}
