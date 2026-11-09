import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  one<T = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  kind: 'pg' | 'pglite';
}

type Runner = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

function wrap(r: Runner, txFn: Db['tx'], exec: Db['exec'], close: Db['close'], kind: Db['kind']): Db {
  const db: Db = {
    kind,
    async query(sql, params) {
      return (await r.query(sql, params as any[])).rows;
    },
    async one(sql, params) {
      return (await r.query(sql, params as any[])).rows[0];
    },
    tx: txFn,
    exec,
    close,
  };
  return db;
}

/** Postgres asli jika DATABASE_URL diisi, selain itu PGlite (Postgres di dalam proses) untuk dev/test. */
export async function openDb(opts: { url?: string; dir?: string; memory?: boolean }): Promise<Db> {
  if (opts.url) {
    const pg = await import('pg');
    const Pool = (pg.default ?? pg).Pool;
    const pool = new Pool({ connectionString: opts.url, max: Number(process.env.PG_POOL_MAX ?? 10) });
    const tx: Db['tx'] = async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const inner = wrap(client, async (f) => f(inner), async (s) => { await client.query(s); }, async () => {}, 'pg');
        const res = await fn(inner);
        await client.query('commit');
        return res;
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    };
    return wrap(pool, tx, async (s) => { await pool.query(s); }, () => pool.end(), 'pg');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  if (!opts.memory && opts.dir) mkdirSync(opts.dir, { recursive: true });
  const lite = opts.memory ? new PGlite() : new PGlite(opts.dir);
  await lite.waitReady;
  // PGlite hanya punya satu koneksi: transaksi dijalankan berurutan lewat antrean
  let chain: Promise<unknown> = Promise.resolve();
  const tx: Db['tx'] = (fn) => {
    const run = chain.then(() =>
      lite.transaction(async (t) => {
        const inner = wrap(t as any, async (f) => f(inner), async (s) => { await t.exec(s); }, async () => {}, 'pglite');
        return fn(inner);
      }),
    );
    chain = run.catch(() => {});
    return run as any;
  };
  const base: Runner = { query: async (sql, params) => { await chain; return lite.query(sql, params as any[]) as any; } };
  return wrap(base, tx, async (s) => { await chain; await lite.exec(s); }, () => lite.close(), 'pglite');
}

export async function migrate(db: Db) {
  await db.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await db.query<{ name: string }>('select name from schema_migrations')).map((r) => r.name));
  const dir = new URL('./migrations/', import.meta.url).pathname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.query('insert into schema_migrations(name) values ($1)', [f]);
    });
  }
}
