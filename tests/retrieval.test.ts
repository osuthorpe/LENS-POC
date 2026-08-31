import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '@/lib/db';
import type { EmbeddingProvider } from '@/lib/embeddings';
import {
  clearQueryEmbeddingCache,
  retrieveEvidence,
} from '@/lib/retrieval';

const embedding = Array.from({ length: 1536 }, () => 0.01);
const query = vi.mocked(pool.query);

function providerWith(embedTexts: EmbeddingProvider['embedTexts']): EmbeddingProvider {
  return {
    model: 'text-embedding-3-large',
    dimensions: 1536,
    embedTexts,
  };
}

function evidenceRow(companyId: string) {
  return {
    id: `${companyId}-meeting`,
    company_id: companyId,
    source_type: 'meeting',
    title: 'Company review',
    source_locator: 'demo_data/raw/meetings/company-review.md',
    source_date: new Date('2026-08-20T12:00:00Z'),
    verification_status: 'meeting note',
    normalized_content: 'Annual recurring revenue is 3.4 million USD.',
    raw_content: {},
    score: 0.91,
    source_quality: 0.94,
  };
}

describe('embedding retrieval', () => {
  beforeEach(() => {
    query.mockReset();
    clearQueryEmbeddingCache();
  });

  it('keeps the company and embedding filters in the database query', async () => {
    const embedTexts = vi.fn().mockResolvedValue([embedding]);
    const provider = providerWith(embedTexts);
    query.mockResolvedValue({ rows: [evidenceRow('cmp_vectorforge')] } as never);

    const evidence = await retrieveEvidence(
      'cmp_vectorforge',
      'revenue runway',
      12,
      provider,
    );

    expect(embedTexts).toHaveBeenCalledWith(['revenue runway']);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE sr.company_id = $1'),
      [
        'cmp_vectorforge',
        'revenue runway',
        expect.stringMatching(/^\[.+\]$/),
        12,
        provider.model,
        provider.dimensions,
      ],
    );
    const sql = query.mock.calls[0]?.[0];
    expect(sql).toContain('AND dc.company_id = $1');
    expect(sql).toContain('AND dc.embedding_model = $5');
    expect(sql).toContain('AND dc.embedding_dimensions = $6');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.companyId).toBe('cmp_vectorforge');
  });

  it('reuses one query vector and keeps company results separate', async () => {
    const embedTexts = vi.fn().mockResolvedValue([embedding]);
    const provider = providerWith(embedTexts);
    query.mockImplementation(async (_sql, values) => ({
      rows: [evidenceRow(String(values?.[0]))],
    }) as never);

    const vectorForge = await retrieveEvidence(
      'cmp_vectorforge',
      'company state',
      30,
      provider,
    );
    const lumenOps = await retrieveEvidence(
      'cmp_lumenops',
      'company state',
      30,
      provider,
    );

    expect(embedTexts).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.arrayContaining(['cmp_vectorforge']),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.arrayContaining(['cmp_lumenops']),
    );
    expect(vectorForge[0]?.companyId).toBe('cmp_vectorforge');
    expect(lumenOps[0]?.companyId).toBe('cmp_lumenops');
  });

  it('removes a failed request from the query cache', async () => {
    const embedTexts = vi.fn()
      .mockRejectedValueOnce(new Error('The embedding service is not available.'))
      .mockResolvedValueOnce([embedding]);
    const provider = providerWith(embedTexts);
    query.mockResolvedValue({ rows: [] } as never);

    await expect(retrieveEvidence(
      'cmp_vectorforge',
      'company state',
      30,
      provider,
    )).rejects.toThrow('not available');
    await expect(retrieveEvidence(
      'cmp_vectorforge',
      'company state',
      30,
      provider,
    )).resolves.toEqual([]);

    expect(embedTexts).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('keeps query vectors separate for different providers', async () => {
    const firstEmbed = vi.fn().mockResolvedValue([embedding]);
    const secondEmbed = vi.fn().mockResolvedValue([embedding]);
    const firstProvider = providerWith(firstEmbed);
    const secondProvider = providerWith(secondEmbed);
    query.mockResolvedValue({ rows: [] } as never);

    await retrieveEvidence('cmp_vectorforge', 'company state', 30, firstProvider);
    await retrieveEvidence('cmp_vectorforge', 'company state', 30, secondProvider);

    expect(firstEmbed).toHaveBeenCalledTimes(1);
    expect(secondEmbed).toHaveBeenCalledTimes(1);
  });
});
