import { resolve } from 'node:path';
import { pool } from '../lib/db';
import { importFixtures } from '../lib/ingestion';

try {
  const result = await importFixtures(resolve(process.cwd(), 'demo_data'));
  console.log('The demo data import is complete.');
  console.table(result);
} finally {
  await pool.end();
}
