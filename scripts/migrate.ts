import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../lib/db';

const schema = await readFile(resolve(process.cwd(), 'db/schema.sql'), 'utf8');

try {
  await pool.query(schema);
  console.log('The database schema is ready.');
} finally {
  await pool.end();
}
