import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const companyId = new URL(request.url).searchParams.get('companyId');
  if (!/^[a-z][a-z0-9-]{2,80}$/.test(id) || !companyId || !/^cmp_[a-z0-9]+$/.test(companyId)) {
    return NextResponse.json({ error: 'The source request is not valid.' }, { status: 400 });
  }
  const result = await pool.query(
    `SELECT
      id,
      company_id,
      source_type,
      title,
      source_locator,
      COALESCE(event_date, publication_date, source_modified_date) AS source_date,
      event_date,
      publication_date,
      source_modified_date,
      ingested_at,
      verified_at,
      access_metadata,
      verification_status,
      source_quality,
      normalized_content,
      raw_content
    FROM source_records
    WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  const source = result.rows[0];
  if (!source) {
    return NextResponse.json(
      { error: 'The source does not exist for this company.' },
      { status: 404 },
    );
  }
  const factResult = await pool.query(
    `SELECT fact_key, fact_value, fact_date, verification_status
    FROM facts
    WHERE source_record_id = $1 AND company_id = $2
    ORDER BY fact_date DESC NULLS LAST, id`,
    [id, companyId],
  );
  return NextResponse.json({
    source: {
      id: source.id,
      companyId: source.company_id,
      sourceType: source.source_type,
      title: source.title,
      sourceDate: source.source_date,
      locator: source.source_locator,
      content: source.normalized_content,
      verificationStatus: source.verification_status,
      eventDate: source.event_date,
      publicationDate: source.publication_date,
      modifiedDate: source.source_modified_date,
      ingestedAt: source.ingested_at,
      verifiedAt: source.verified_at,
      accessMetadata: source.access_metadata,
      sourceQuality: Number(source.source_quality),
      normalizedContent: source.normalized_content,
      rawContent: source.raw_content,
      facts: factResult.rows.map((fact) => ({
        key: fact.fact_key,
        value: fact.fact_value,
        date: fact.fact_date,
        verificationStatus: fact.verification_status,
      })),
    },
  });
}
