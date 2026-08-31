import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await pool.query(
    `SELECT
      id,
      company_id,
      source_type,
      title,
      source_locator,
      COALESCE(event_date, publication_date, source_modified_date) AS source_date,
      verification_status,
      normalized_content,
      raw_content
    FROM source_records
    WHERE id = $1`,
    [id],
  );
  const source = result.rows[0];
  if (!source) {
    return NextResponse.json({ error: 'The source does not exist.' }, { status: 404 });
  }
  return NextResponse.json({ source });
}
