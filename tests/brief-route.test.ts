import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/brief', () => ({
  buildBrief: vi.fn(),
  recordBriefRun: vi.fn(),
  validateCitations: vi.fn(),
}));
vi.mock('@/lib/companies', () => ({
  getCompany: vi.fn(),
}));
vi.mock('@/lib/retrieval', () => ({
  assertCompanyIsolation: vi.fn(),
  DEFAULT_RETRIEVAL_QUERY: 'Current company evidence',
  retrieveEvidence: vi.fn(),
}));

import { POST } from '@/app/api/briefs/route';
import { buildBrief, recordBriefRun } from '@/lib/brief';
import { getCompany } from '@/lib/companies';
import { fallbackBrief, fallbackCompanies } from '@/lib/fallback-data';
import { retrieveEvidence } from '@/lib/retrieval';

const runId = '00000000-0000-4000-8000-000000000001';

describe('brief route', () => {
  beforeEach(() => {
    vi.mocked(buildBrief).mockReset();
    vi.mocked(recordBriefRun).mockReset();
    vi.mocked(getCompany).mockReset();
    vi.mocked(retrieveEvidence).mockReset();
  });

  it('returns the saved brief run ID for feedback', async () => {
    vi.mocked(getCompany).mockResolvedValue(fallbackCompanies[0]);
    vi.mocked(retrieveEvidence).mockResolvedValue([{
      id: 'meeting-001',
      companyId: 'cmp_vectorforge',
    }] as never);
    vi.mocked(buildBrief).mockReturnValue(structuredClone(fallbackBrief));
    vi.mocked(recordBriefRun).mockResolvedValue(runId);

    const response = await POST(new Request('http://localhost/api/briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 'cmp_vectorforge' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.briefRunId).toBe(runId);
    expect(recordBriefRun).toHaveBeenCalledOnce();
  });
});
