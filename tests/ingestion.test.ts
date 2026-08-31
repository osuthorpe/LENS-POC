import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checksum,
  chunkText,
  localEmbedding,
  normalizeFixtures,
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

  it('creates local vectors with the database dimension', () => {
    const vector = localEmbedding('revenue runway customer risk');
    expect(vector).toHaveLength(1536);
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(length).toBeCloseTo(1, 8);
  });

  it('divides long content and keeps all content', () => {
    const text = `${'A'.repeat(800)}\n\n${'B'.repeat(800)}`;
    const chunks = chunkText(text, 1000);
    expect(chunks).toHaveLength(2);
    expect(chunks.join('\n\n')).toBe(text);
  });
});
