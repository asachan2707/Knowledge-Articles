import 'dotenv/config';

const USE_MOCKS = process.env.USE_MOCKS === 'true';

let dbExport;

if (USE_MOCKS) {
  const mock = await import('../mocks/db.js');
  dbExport = mock.db;
  console.log('[db] Using in-memory mock (USE_MOCKS=true)');
} else {
  const pg = await import('pg');
  const pool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });
  pool.on('error', (err) => console.error('[db] Unexpected client error', err.message));
  dbExport = pool;
}

export const db = dbExport;
