import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrgMember, User } from '@prisma/client';
import { RedisService } from 'src/redis/redis.service';
import { JwtPayload } from './interfaces';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { parseDurationToSeconds } from 'src/common/utils';

type TokenUser = Pick<User, 'id' | 'email' | 'systemRole'>;
type TokenOrgMembership = Pick<OrgMember, 'orgId' | 'role'>;

export type RotationStatus = 'valid' | 'missing' | 'mismatch' | 'race_lost';

interface StoredRefreshToken {
  hash: string;
  nonce: string;
}

@Injectable()
export class TokensService {
  // Atomically deletes refresh:{userId} ONLY if the stored nonce still matches
  // the nonce we read during the comparison step.
  //
  // Returns:
  //   1  → consumed (we won)
  //   0  → nonce changed (concurrent request already rotated this token)
  //  -1  → key disappeared between our GET and this call
  //  -2  → stored data was unparseable (treat as missing)
  private readonly CONSUME_SCRIPT = `
    local raw = redis.call('GET', KEYS[1])
    if not raw then return -1 end
    local ok, data = pcall(cjson.decode, raw)
    if not ok then return -2 end
    if data.nonce ~= ARGV[1] then return 0 end
    redis.call('DEL', KEYS[1])
    return 1
  `;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async generateTokens(user: TokenUser, orgMembership?: TokenOrgMembership) {
    const jti = uuidv4();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      jti,
      systemRole: user.systemRole,
      orgId: orgMembership?.orgId,
      orgRole: orgMembership?.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
    });

    await this.storeRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
  }

  /**
   * Verifies the incoming token and atomically consumes it if valid.
   *
   * 'valid'     → token is correct and has been consumed, caller must call
   *               generateTokens() to issue a replacement.
   * 'missing'   → no stored token for this user (expired, logged out, or already
   *               consumed by a prior rotation). Do NOT revoke so there is nothing
   *               to revoke, and revoking would delete a freshly issued token.
   * 'mismatch'  → token exists but hash doesn't match. Suspicious (possible replay
   *               attack or client bug). Reject so don't delete the stored token.
   * 'race_lost' → hash matched but another concurrent request consumed the token
   *               first. Both requests had a valid token; one won. Do NOT revoke.
   */
  async verifyAndConsumeRefreshToken(
    userId: string,
    incomingToken: string,
  ): Promise<RotationStatus> {
    const key = `refresh:${userId}`;

    const raw = await this.redis.get(key);
    if (!raw) return 'missing';

    let stored: StoredRefreshToken;
    try {
      stored = JSON.parse(raw) as StoredRefreshToken;
    } catch {
      return 'missing';
    }

    if (typeof stored.hash !== 'string' || typeof stored.nonce !== 'string') {
      return 'missing';
    }

    const isValid = await bcrypt.compare(this.toSafeHash(incomingToken), stored.hash);
    if (!isValid) return 'mismatch';

    const result = await this.redis.eval(this.CONSUME_SCRIPT, 1, key, stored.nonce);

    switch (result) {
      case 1:
        return 'valid';
      case 0:
        return 'race_lost';
      case -1:
        return 'missing';
      default:
        return 'missing'; // -2 (parse error) or unexpected value
    }
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const ttlRaw = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    const ttl = parseDurationToSeconds(ttlRaw);
    await this.redis.setex(
      `tokens-valid-after:${userId}`,
      (Math.floor(Date.now() / 1000) + 1).toString(),
      ttl,
    );
  }
  async isIssuedBeforeRevocation(userId: string, issuedAt: number): Promise<boolean> {
    const validAfter = await this.redis.get(`tokens-valid-after:${userId}`);
    return validAfter !== null && issuedAt < Number(validAfter);
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hash = await bcrypt.hash(this.toSafeHash(refreshToken), 12);
    const data: StoredRefreshToken = { hash, nonce: uuidv4() };
    await this.redis.setex(
      `refresh:${userId}`,
      JSON.stringify(data),
      parseDurationToSeconds(this.config.getOrThrow('JWT_REFRESH_EXPIRES_IN')),
    );
  }

  private toSafeHash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
