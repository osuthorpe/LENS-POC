import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/brief', () => ({
  recordBriefRun: vi.fn(),
  validateCitations: vi.fn(),
}));
vi.mock('@/lib/brief-generation', () => ({
  BRIEF_REQUEST_BUDGET_MS: 25_000,
  generateGroundedBrief: vi.fn(),
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
import { recordBriefRun, validateCitations } from '@/lib/brief';
import { generateGroundedBrief } from '@/lib/brief-generation';
import { getCompany } from '@/lib/companies';
import { fallbackBrief, fallbackCompanies } from '@/lib/fallback-data';
import { assertCompanyIsolation, retrieveEvidence } from '@/lib/retrieval';

const runId = '00000000-0000-4000-8000-000000000001';

describe('brief route', () => {
  beforeEach(() => {
    vi.mocked(recordBriefRun).mockReset();
    vi.mocked(validateCitations).mockReset();
    vi.mocked(generateGroundedBrief).mockReset();
    vi.mocked(getCompany).mockReset();
    vi.mocked(retrieveEvidence).mockReset();
    vi.mocked(assertCompanyIsolation).mockReset();
  });

  it('saves a generated brief and returns its run ID', async () => {
    const company = fallbackCompanies[0];
    const evidence = [{
      id: 'meeting-001',
      companyId: 'cmp_vectorforge',
    }] as never;
    const generatedBrief = {
      ...structuredClone(fallbackBrief),
      mode: 'openai-grounded' as const,
      generationModel: 'gpt-5.6-sol',
      generationReasoningEffort: 'low' as const,
      generationPromptVersion: 'grounded-brief-v2',
      generationResponseId: 'resp_route_test',
      generationInputTokens: 220,
      generationOutputTokens: 90,
      generationDurationMs: 150,
      generationFallbackReason: null,
    };
    vi.mocked(getCompany).mockResolvedValue(company);
    vi.mocked(retrieveEvidence).mockResolvedValue(evidence);
    vi.mocked(generateGroundedBrief).mockResolvedValue(generatedBrief);
    vi.mocked(recordBriefRun).mockResolvedValue(runId);

    const response = await POST(new Request('http://localhost/api/briefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: 'cmp_vectorforge' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.briefRunId).toBe(runId);
    expect(body.mode).toBe('openai-grounded');
    expect(assertCompanyIsolation).toHaveBeenCalledWith(
      'cmp_vectorforge',
      evidence,
    );
    expect(generateGroundedBrief).toHaveBeenCalledWith(
      company,
      evidence,
      undefined,
      expect.any(Number),
    );
    expect(validateCitations).toHaveBeenCalledWith(generatedBrief);
    expect(recordBriefRun).toHaveBeenCalledWith(generatedBrief, evidence);
  });
});
