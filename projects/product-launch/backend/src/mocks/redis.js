/**
 * In-memory mock for Redis — multi-product version.
 * Keys are product-scoped: flash:stock:{productId}, waitlist:count:{productId}
 */

const store  = new Map();
const pubsub = new Map();

// Pre-seed matching the three mock products
const P1 = 'prod-1111-1111-1111-111111111111';
const P2 = 'prod-2222-2222-2222-222222222222';
const P3 = 'prod-3333-3333-3333-333333333333';

store.set(`waitlist:count:${P1}`, '2');
store.set(`waitlist:count:${P2}`, '1');
store.set(`waitlist:count:${P3}`, '2');

store.set(`flash:stock:${P1}`,  '100');
store.set(`flash:active:${P1}`, '0');

store.set(`flash:stock:${P2}`,  '50');
store.set(`flash:active:${P2}`, '0');

store.set(`flash:stock:${P3}`,  '200');
store.set(`flash:active:${P3}`, '1');  // P3 is already launched

store.set('viewers:count', '0');

function makeMockRedis() {
  return {
    async ping()                { return 'PONG'; },
    async get(key)              { return store.get(key) ?? null; },
    async set(key, val)         { store.set(key, String(val)); return 'OK'; },
    async setEx(key, _ttl, val) { store.set(key, String(val)); return 'OK'; },
    async del(key)              { store.delete(key); return 1; },

    async incr(key) {
      const n = parseInt(store.get(key) ?? '0', 10) + 1;
      store.set(key, String(n));
      return n;
    },

    async decr(key) {
      const n = parseInt(store.get(key) ?? '0', 10) - 1;
      store.set(key, String(n));
      return n;
    },

    async publish(channel, message) {
      const subs = pubsub.get(channel);
      if (subs) subs.forEach(cb => setImmediate(() => cb(message)));
      return subs ? subs.size : 0;
    },

    async subscribe(channel, callback) {
      if (!pubsub.has(channel)) pubsub.set(channel, new Set());
      pubsub.get(channel).add(callback);
    },

    async quit()  { return 'OK'; },
    on(_evt, _cb) {},
  };
}

export const redis    = makeMockRedis();
export const redisSub = makeMockRedis();

export async function connectRedis() {
  console.log('[mock-redis] connected (in-memory, multi-product)');
}
