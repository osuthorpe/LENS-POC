import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

import { GET } from '@/app/api/sources/[id]/route';
import { pool } from '@/lib/db';

const query = vi.mocked(pool.query);

function request(sourceId: string, companyId?: string) {
  const suffix = companyId ? `?companyId=${companyId}` : '';
  return GET(
    new Request(`http://localhost/api/sources/${sourceId}${suffix}`),
    { params: Promise.resolve({ id: sourceId }) },
  );
}

describe('source detail route', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('rejects a request without a valid company ID', async () => {
    const response = await request('meeting-001');
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('uses the source ID and company ID in the source query', async () => {
    query.mockResolvedValueOnce({ rows: [] } as never);
    const response = await request('meeting-001', 'cmp_vectorforge');
    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND company_id = $2'),
      ['meeting-001', 'cmp_vectorforge'],
    );
  });

  it('returns source provenance, original fields, and facts', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: 'meeting-001',
          company_id: 'cmp_vectorforge',
          source_type: 'meeting',
          title: 'VectorForge Portfolio Review',
          source_locator: 'demo_data/raw/meetings/vectorforge-2026-07-25.md',
          source_date: '2026-07-25T15:00:00Z',
          event_date: '2026-07-25T15:00:00Z',
          publication_date: null,
          source_modified_date: '2026-07-25T15:00:00Z',
          ingested_at: '2026-08-31T12:00:00Z',
          verified_at: '2026-07-25T15:00:00Z',
          access_metadata: { scope: 'demo', access: 'approved' },
          verification_status: 'direct company statement',
          source_quality: 0.95,
          normalized_content: 'Annual recurring revenue is 3.4 million USD.',
          raw_content: { participants: ['RC'] },
        }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{
          fact_key: 'annual_recurring_revenue',
          fact_value: '3.4 million USD',
          fact_date: '2026-07-25T15:00:00Z',
          verification_status: 'direct company statement',
        }],
      } as never);

    const response = await request('meeting-001', 'cmp_vectorforge');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.source.companyId).toBe('cmp_vectorforge');
    expect(body.source.rawContent).toEqual({ participants: ['RC'] });
    expect(body.source.facts).toEqual([
      {
        key: 'annual_recurring_revenue',
        value: '3.4 million USD',
        date: '2026-07-25T15:00:00Z',
        verificationStatus: 'direct company statement',
      },
    ]);
  });
});
