// ─── Redis distributed lock (SET NX + Lua atomic release) ────────────────────
// Prevents double-match: only one driver can win a given rideId.

import { v4 as uuid } from 'uuid';
import { getRedis } from './redis';
import { LOCK_TTL_SEC } from './constants';

const RELEASE_LUA = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

export async function acquireLock(rideId: string): Promise<string | null> {
  const redis = getRedis();
  const token = uuid();
  const result = await redis.set(
    `ride:${rideId}:lock`,
    token,
    'EX', LOCK_TTL_SEC,
    'NX',
  );
  return result === 'OK' ? token : null;
}

export async function releaseLock(rideId: string, token: string): Promise<void> {
  const redis = getRedis();
  await redis.eval(RELEASE_LUA, 1, `ride:${rideId}:lock`, token);
}
