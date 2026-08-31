import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://aivc:aivc_local@127.0.0.1:5438/aivc';

const globalDatabase = globalThis as typeof globalThis & {
  aivcPool?: Pool;
};

export const pool =
  globalDatabase.aivcPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 3000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalDatabase.aivcPool = pool;
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function firstRow<T extends QueryResultRow>(rows: T[], message: string) {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}
