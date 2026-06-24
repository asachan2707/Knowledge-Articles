import Redis from 'ioredis';

let _client: Redis | null = null;

export function getRedis(): Redis {
  if (!_client) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    _client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
    _client.on('error', err => console.error('[redis]', err.message));
    _client.connect().catch(() => {});
  }
  return _client;
}
