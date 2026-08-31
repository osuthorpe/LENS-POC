import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EmbeddingProvider } from '@/lib/embeddings';
import {
  checksum,
  chunkText,
  embeddingIsCurrent,
  normalizeFixtures,
  type ChunkEntry,
  type StoredChunk,
} from '@/lib/ingestion';

const fixtureRoot = resolve(process.cwd(), 'demo_data');

describe('fixture normalization', () => {
  it('normalizes all companies and source records', async () => {
    const result = await normalizeFixtures(fixtureRoot);
    expect(result.companies).toHaveLength(10);
    expect(result.records).toHaveLength(59);
    expect(new Set(result.records.map((record) => record.sourceType))).toEqual(
      new Set(['crm', 'meeting', 'slack', 'news']),
    );
  });

  it('assigns each record to one known company', async () => {
    const result = await normalizeFixtures(fixtureRoot);
    const companyIds = new Set(result.companies.map((company) => company.company_id));
    expect(
      result.records.every((record) => companyIds.has(record.companyId)),
    ).toBe(true);
  });

  it('creates a stable content checksum', () => {
    expect(checksum({ value: 1 })).toBe(checksum({ value: 1 }));
    expect(checksum({ value: 1 })).not.toBe(checksum({ value: 2 }));
  });

  it('accepts a stored embedding with the current fingerprint', () => {
    const provider: EmbeddingProvider = {
      model: 'text-embedding-3-large',
      dimensions: 1536,
      embedTexts: async () => [],
    };
    const entry = {
      id: 'meeting-001:chunk:0',
      record: { id: 'meeting-001' },
      content: 'Annual recurring revenue is 3.4 million USD.',
      position: 0,
      inputChecksum: 'current-checksum',
    } as ChunkEntry;
    const stored: StoredChunk = {
      id: entry.id,
      source_record_id: entry.record.id,
      content: entry.content,
      has_embedding: true,
      embedding_model: provider.model,
      embedding_dimensions: provider.dimensions,
      embedding_input_checksum: entry.inputChecksum,
    };

    expect(embeddingIsCurrent(stored, entry, provider)).toBe(true);
  });

  it.each([
    ['a missing vector', { has_embedding: false }],
    ['changed text', { content: 'Annual recurring revenue changed.' }],
    ['a different model', { embedding_model: 'text-embedding-3-small' }],
    ['a different dimension', { embedding_dimensions: 3072 }],
    ['a different input checksum', { embedding_input_checksum: 'old-checksum' }],
  ])('rejects %s in the stored embedding fingerprint', (_name, change) => {
    const provider: EmbeddingProvider = {
      model: 'text-embedding-3-large',
      dimensions: 1536,
      embedTexts: async () => [],
    };
    const entry = {
      id: 'meeting-001:chunk:0',
      record: { id: 'meeting-001' },
      content: 'Annual recurring revenue is 3.4 million USD.',
      position: 0,
      inputChecksum: 'current-checksum',
    } as ChunkEntry;
    const stored: StoredChunk = {
      id: entry.id,
      source_record_id: entry.record.id,
      content: entry.content,
      has_embedding: true,
      embedding_model: provider.model,
      embedding_dimensions: provider.dimensions,
      embedding_input_checksum: entry.inputChecksum,
      ...change,
    };

    expect(embeddingIsCurrent(stored, entry, provider)).toBe(false);
  });

  it('divides long content and keeps all content', () => {
    const text = `${'A'.repeat(800)}\n\n${'B'.repeat(800)}`;
    const chunks = chunkText(text, 1000);
    expect(chunks).toHaveLength(2);
    expect(chunks.join('\n\n')).toBe(text);
  });

  it('divides one long paragraph into bounded chunks', () => {
    const chunks = chunkText('A'.repeat(2500), 1000);

    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true);
    expect(chunks.join('')).toBe('A'.repeat(2500));
  });
});
