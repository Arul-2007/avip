const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool, types } = require('pg');
const {
  DATABASE_URL, DB_SCHEMA_FILE, DB_SSL, DATA_DIR, UPLOAD_DIR, SEED_ENABLED
} = require('./config');
const { seedDatabase } = require('./seed');

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const transactionContext = new AsyncLocalStorage();
let pool = null;
let instance = null;

function assertConfigured() {
  if (!DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not configured. Create avip/.env from .env.example and set the Supabase Postgres connection string.'
    );
  }
}

function translateSql(sql) {
  let index = 0;
  return String(sql)
    .replace(/\browid\b/g, 'seq')
    .replace(/\?/g, () => `$${++index}`);
}

function currentExecutor() {
  const client = transactionContext.getStore();
  if (client) return client;
  if (!pool) throw new Error('Database pool is not initialized. Call getDb() first.');
  return pool;
}

async function execute(sql, params) {
  const executor = currentExecutor();
  return executor.query(translateSql(sql), params);
}

function prepare(sql) {
  return {
    async get(...params) {
      const result = await execute(sql, params);
      return result.rows[0];
    },
    async all(...params) {
      const result = await execute(sql, params);
      return result.rows;
    },
    async run(...params) {
      const result = await execute(sql, params);
      return { changes: result.rowCount, rowCount: result.rowCount, rows: result.rows };
    }
  };
}

async function exec(sql) {
  const executor = currentExecutor();
  await executor.query(translateSql(sql));
}

async function transaction(fn) {
  if (transactionContext.getStore()) return fn();
  const client = await currentExecutor().connect();
  try {
    await client.query('BEGIN');
    const result = await transactionContext.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures so the original error is surfaced.
    }
    throw error;
  } finally {
    client.release();
  }
}

function makeDb() {
  return {
    prepare,
    exec,
    transaction,
    query: execute,
    async ping() {
      const result = await execute('SELECT 1 AS ok', []);
      return result.rows[0] && result.rows[0].ok === 1;
    },
    async close() {
      await closeDb();
    }
  };
}

async function openDatabase() {
  assertConfigured();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DB_SSL ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000
    });
    pool.on('error', (error) => {
      console.error(`[db] idle client error: ${error.message}`);
    });
  }
  const schema = fs.readFileSync(DB_SCHEMA_FILE, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(schema);
  } finally {
    client.release();
  }
  const db = makeDb();
  if (SEED_ENABLED) await seedDatabase(db);
  return db;
}

async function getDb() {
  if (!instance) instance = await openDatabase();
  return instance;
}

async function closeDb() {
  instance = null;
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
}

module.exports = { getDb, openDatabase, closeDb, transaction };
