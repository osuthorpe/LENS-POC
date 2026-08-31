import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query<{ company_count: string; record_count: string }>(
      `SELECT
        (SELECT COUNT(*) FROM companies)::text AS company_count,
        (SELECT COUNT(*) FROM source_records)::text AS record_count`,
    );
    return NextResponse.json({
      status: 'ready',
      companyCount: Number(result.rows[0]?.company_count ?? 0),
      recordCount: Number(result.rows[0]?.record_count ?? 0),
    });
  } catch {
    return NextResponse.json(
      { status: 'not_ready' },
      { status: 503 },
    );
  }
}
