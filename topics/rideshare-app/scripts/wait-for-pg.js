#!/usr/bin/env node
// Polls PostgreSQL until it is ready, then exits 0.
const { Client } = require('pg');

const url = process.env.POSTGRES_URL || 'postgresql://rideshare:rideshare@localhost:5432/rideshare';
const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000;

async function wait() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('✓ PostgreSQL is ready');
      process.exit(0);
    } catch {
      console.log(`  Waiting for PostgreSQL… (${i}/${MAX_ATTEMPTS})`);
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }
  console.error('✗ PostgreSQL did not become ready in time');
  process.exit(1);
}

wait();
