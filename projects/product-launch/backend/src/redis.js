import 'dotenv/config';

const USE_MOCKS = process.env.USE_MOCKS === 'true';

let redis, redisSub, connectRedis;

if (USE_MOCKS) {
  const mock = await import('./mocks/redis.js');
  redis        = mock.redis;
  redisSub     = mock.redisSub;
  connectRedis = mock.connectRedis;
  console.log('[redis] Using in-memory mock (USE_MOCKS=true)');
} else {
  const { createClient } = await import('redis');

  redis    = createClient({ url: process.env.REDIS_URL });
  redisSub = createClient({ url: process.env.REDIS_URL });

  redis.on('error',    (err) => console.error('[redis] error',     err.message));
  redisSub.on('error', (err) => console.error('[redis-sub] error', err.message));

  connectRedis = async () => {
    await redis.connect();
    await redisSub.connect();
    console.log('[redis] connected');
  };
}

export { redis, redisSub, connectRedis };
