#!/usr/bin/env node
// Runs infra/postgres/init.sql against the local PostgreSQL instance.
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const url = process.env.POSTGRES_URL || 'postgresql://rideshare:rideshare@localhost:5432/rideshare';
const sql = fs.readFileSync(path.join(__dirname, '../infra/postgres/init.sql'), 'utf8');

async function migrate() {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log('✓ Database schema applied');
  } catch (err) {
    // idempotent — ignore "already exists" errors on re-runs
    if (err.code === '42P07' || err.code === '42710') {
      console.log('✓ Schema already up to date');
    } else {
      throw err;
    }
  } finally {
    await client.end();
  }
}

module.exports = migrate;

if (require.main === module) migrate().catch(e => { console.error(e); process.exit(1); });
