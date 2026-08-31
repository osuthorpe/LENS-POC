import { pool } from '@/lib/db';
import {
  embedText,
  openAiEmbeddingProvider,
  toVectorLiteral,
  validateEmbedding,
  type EmbeddingProvider,
} from '@/lib/embeddings';
import type { SourceReference } from '@/lib/types';

export interface RetrievedEvidence extends SourceReference {
  companyId: string;
  normalizedContent: string;
  rawContent: Record<string, unknown>;
  score: number;
  sourceQuality: number;
}

export const DEFAULT_RETRIEVAL_QUERY = [
  'company state',
  'revenue',
  'runway',
  'burn',
  'customers',
  'product',
  'team',
  'funding',
  'changes',
  'risks',
  'missing information',
].join(' ');

const QUERY_CACHE_LIMIT = 16;
let queryEmbeddingCaches = new WeakMap<
  EmbeddingProvider,
  Map<string, Promise<number[]>>
>();

export function clearQueryEmbeddingCache() {
  queryEmbeddingCaches = new WeakMap();
}

async function getQueryEmbedding(
  query: string,
  provider: EmbeddingProvider,
) {
  let cache = queryEmbeddingCaches.get(provider);
  if (!cache) {
    cache = new Map();
    queryEmbeddingCaches.set(provider, cache);
  }
  const cached = cache.get(query);
  if (cached) {
    cache.delete(query);
    cache.set(query, cached);
    return cached;
  }

  const request = embedText(query, provider).catch((error) => {
    cache.delete(query);
    throw error;
  });
  if (cache.size >= QUERY_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(query, request);
  return request;
}

export async function retrieveEvidence(
  companyId: string,
  query = DEFAULT_RETRIEVAL_QUERY,
  limit = 30,
  provider: EmbeddingProvider = openAiEmbeddingProvider,
) {
  const queryEmbedding = await getQueryEmbedding(query, provider);
  validateEmbedding(queryEmbedding, provider.dimensions, 0);
  const queryVector = toVectorLiteral(queryEmbedding);
  const result = await pool.query<{
    id: string;
    company_id: string;
    source_type: SourceReference['sourceType'];
    title: string;
    source_locator: string;
    source_date: Date;
    verification_status: string | null;
    normalized_content: string;
    raw_content: Record<string, unknown>;
    score: number;
    source_quality: number;
  }>(
    `WITH ranked_chunks AS (
      SELECT
        sr.id,
        sr.company_id,
        sr.source_type,
        sr.title,
        sr.source_locator,
        COALESCE(sr.event_date, sr.publication_date, sr.source_modified_date) AS source_date,
        sr.verification_status,
        sr.normalized_content,
        sr.raw_content,
        sr.source_quality,
        MAX(
          0.38 * ts_rank_cd(dc.search_document, websearch_to_tsquery('english', $2)) +
          0.32 * COALESCE(1 - (dc.embedding <=> $3::vector), 0) +
          0.20 * sr.source_quality +
          0.10 * GREATEST(0, 1 - EXTRACT(EPOCH FROM (
            TIMESTAMPTZ '2026-08-31T23:59:59Z' -
            COALESCE(sr.event_date, sr.publication_date, sr.source_modified_date)
          )) / 15552000)
        ) AS score
      FROM source_records sr
      JOIN document_chunks dc ON dc.source_record_id = sr.id
      WHERE sr.company_id = $1
        AND dc.company_id = $1
        AND dc.embedding IS NOT NULL
        AND dc.embedding_model = $5
        AND dc.embedding_dimensions = $6
      GROUP BY sr.id
    )
    SELECT * FROM ranked_chunks
    ORDER BY score DESC, source_date DESC NULLS LAST
    LIMIT $4`,
    [companyId, query, queryVector, limit, provider.model, provider.dimensions],
  );

  return result.rows.map((row): RetrievedEvidence => ({
    id: row.id,
    companyId: row.company_id,
    sourceType: row.source_type,
    title: row.title,
    sourceDate: row.source_date.toISOString(),
    locator: row.source_locator,
    content: row.normalized_content,
    normalizedContent: row.normalized_content,
    rawContent: row.raw_content,
    verificationStatus: row.verification_status,
    score: Number(row.score),
    sourceQuality: Number(row.source_quality),
  }));
}

export function assertCompanyIsolation(
  companyId: string,
  evidence: RetrievedEvidence[],
) {
  const leaked = evidence.find((record) => record.companyId !== companyId);
  if (leaked) {
    throw new Error(`Evidence ${leaked.id} belongs to a different company.`);
  }
}
