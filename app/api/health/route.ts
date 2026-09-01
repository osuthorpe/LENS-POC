import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from '@/lib/embeddings';
import {
  BRIEF_GENERATION_MODEL,
  BRIEF_GENERATION_PROMPT_VERSION,
  BRIEF_GENERATION_REASONING_EFFORT,
} from '@/lib/brief-generation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await pool.query<{
      company_count: string;
      record_count: string;
      chunk_count: string;
      embedding_count: string;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM companies)::text AS company_count,
        (SELECT COUNT(*) FROM source_records)::text AS record_count,
        (SELECT COUNT(*) FROM document_chunks)::text AS chunk_count,
        (SELECT COUNT(*) FROM document_chunks
          WHERE embedding IS NOT NULL
            AND embedding_model = $1
            AND embedding_dimensions = $2)::text AS embedding_count`,
      [EMBEDDING_MODEL, EMBEDDING_DIMENSIONS],
    );
    const row = result.rows[0];
    const chunkCount = Number(row?.chunk_count ?? 0);
    const embeddingCount = Number(row?.embedding_count ?? 0);
    const apiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
    const ready = apiConfigured && chunkCount > 0 && embeddingCount === chunkCount;
    return NextResponse.json({
      status: ready ? 'ready' : 'not_ready',
      companyCount: Number(row?.company_count ?? 0),
      recordCount: Number(row?.record_count ?? 0),
      chunkCount,
      embeddingCount,
      apiConfigured,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      generationModel: BRIEF_GENERATION_MODEL,
      generationReasoningEffort: BRIEF_GENERATION_REASONING_EFFORT,
      generationPromptVersion: BRIEF_GENERATION_PROMPT_VERSION,
    }, { status: ready ? 200 : 503 });
  } catch {
    return NextResponse.json(
      { status: 'not_ready' },
      { status: 503 },
    );
  }
}
