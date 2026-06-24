import Redis from 'ioredis';

export function createRedisClient() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
  client.on('error', err => console.error('[redis]', err.message));
  client.connect().catch(() => {});
  return client;
}
