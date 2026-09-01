import { describe, expect, it, vi } from 'vitest';
import {
  BRIEF_GENERATION_MAX_OUTPUT_TOKENS,
  BRIEF_GENERATION_MODEL,
  BRIEF_GENERATION_REASONING_EFFORT,
  BRIEF_GENERATION_TIMEOUT_MS,
  BRIEF_GENERATION_PROMPT_VERSION,
  BRIEF_REQUEST_BUDGET_MS,
  BriefGenerationFailure,
  createOpenAiBriefGenerationProvider,
  generateGroundedBrief,
  type BriefGenerationProvider,
  type GeneratedBriefSections,
} from '@/lib/brief-generation';
import { fallbackCompanies } from '@/lib/fallback-data';
import type { RetrievedEvidence } from '@/lib/retrieval';

const company = {
  ...fallbackCompanies[0],
  id: 'cmp_systemrule',
  name: 'System Rule AI',
  lastReviewDate: null,
};

const evidence: RetrievedEvidence[] = [
  {
    id: 'meeting-systemrule',
    companyId: company.id,
    sourceType: 'meeting',
    title: 'Company review',
    sourceDate: '2026-08-20T12:00:00Z',
    locator: 'LOCATOR-SENTINEL',
    content: 'Monthly burn is 420,000 USD. Reported runway is 9 months.',
    normalizedContent: 'Monthly burn is 420,000 USD. Reported runway is 9 months.',
    rawContent: { privateValue: 'RAW-CONTENT-SENTINEL' },
    verificationStatus: 'meeting note',
    score: 0.96,
    sourceQuality: 0.94,
  },
  {
    id: 'slack-systemrule',
    companyId: company.id,
    sourceType: 'slack',
    title: 'Renewal review',
    sourceDate: '2026-08-21T12:00:00Z',
    locator: 'thread-systemrule-renewal',
    content: 'The customer renewal risk needs review.',
    normalizedContent: 'The customer renewal risk needs review.',
    rawContent: { channel: 'systemrule' },
    verificationStatus: 'confirmed',
    score: 0.9,
    sourceQuality: 0.88,
  },
];

function validSections(): GeneratedBriefSections {
  return {
    currentState: [{
      text: 'Monthly burn is 420,000 USD.',
      sourceIds: ['meeting-systemrule'],
      evidenceQuotes: [{
        sourceId: 'meeting-systemrule',
        quote: 'Monthly burn is 420,000 USD.',
      }],
      state: 'confirmed',
    }],
    changes: [{
      text: 'Reported runway is 9 months.',
      sourceIds: ['meeting-systemrule'],
      evidenceQuotes: [{
        sourceId: 'meeting-systemrule',
        quote: 'Reported runway is 9 months.',
      }],
      state: 'confirmed',
    }],
    risks: [{
      text: 'The customer renewal risk needs review.',
      sourceIds: ['slack-systemrule'],
      evidenceQuotes: [{
        sourceId: 'slack-systemrule',
        quote: 'The customer renewal risk needs review.',
      }],
      state: 'confirmed',
    }],
    openQuestions: [{
      text: 'What is the customer renewal date?',
      sourceIds: ['slack-systemrule'],
      evidenceQuotes: [{
        sourceId: 'slack-systemrule',
        quote: 'The customer renewal risk needs review.',
      }],
      state: 'missing',
    }],
    suggestedQuestions: [{
      text: 'What action will reduce the customer renewal risk?',
      sourceIds: ['slack-systemrule'],
      evidenceQuotes: [{
        sourceId: 'slack-systemrule',
        quote: 'The customer renewal risk needs review.',
      }],
      state: 'confirmed',
    }],
  };
}

function providerWith(
  generate: BriefGenerationProvider['generate'],
): BriefGenerationProvider {
  return {
    model: BRIEF_GENERATION_MODEL,
    reasoningEffort: BRIEF_GENERATION_REASONING_EFFORT,
    promptVersion: BRIEF_GENERATION_PROMPT_VERSION,
    generate,
  };
}

function successfulResponse(sections = validSections()) {
  return {
    sections,
    responseId: 'resp_grounded_test',
    inputTokens: 210,
    outputTokens: 90,
    durationMs: 140,
  };
}

describe('grounded brief generation', () => {
  it('creates a brief from a valid generated result', async () => {
    const generate = vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse());

    const brief = await generateGroundedBrief(
      company,
      evidence,
      providerWith(generate),
      BRIEF_REQUEST_BUDGET_MS,
    );

    expect(generate).toHaveBeenCalledWith({
      company,
      evidence,
      timeoutMs: BRIEF_GENERATION_TIMEOUT_MS,
    });
    expect(brief.mode).toBe('openai-grounded');
    expect(brief.generationFallbackReason).toBeNull();
    expect(brief.generationResponseId).toBe('resp_grounded_test');
    expect(brief.currentState[0]).toMatchObject({
      id: 'current-1',
      text: 'Monthly burn is 420,000 USD.',
      sourceIds: ['meeting-systemrule'],
      kind: 'fact',
    });
    expect(brief.currentState[0]?.citations).toHaveLength(1);
  });

  it('uses the fallback for an unsupported number', async () => {
    const sections = validSections();
    sections.currentState[0]!.text = 'Monthly burn is 920,000 USD.';
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe('unsupported_value');
  });

  it('uses the fallback for an evidence quote that is not exact', async () => {
    const sections = validSections();
    sections.currentState[0]!.evidenceQuotes[0]!.quote =
      'Monthly burn is approximately 420,000 USD.';
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe('invalid_quote');
  });

  it('uses the fallback for a qualitative claim that its quote does not support', async () => {
    const sections = validSections();
    sections.currentState[0]!.text = 'The chief executive resigned.';
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe('unsupported_claim');
  });

  it('uses the fallback for an unknown source', async () => {
    const sections = validSections();
    sections.currentState[0]!.sourceIds = ['meeting-other-company'];
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe('unknown_source');
  });

  it('uses the fallback for a duplicate source', async () => {
    const sections = validSections();
    sections.currentState[0]!.sourceIds = [
      'meeting-systemrule',
      'meeting-systemrule',
    ];
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe('duplicate_source');
  });

  it('adds a required unverified risk from source status', async () => {
    const unverifiedEvidence = evidence.map((record) =>
      record.id === 'slack-systemrule'
        ? { ...record, verificationStatus: 'unverified' }
        : record,
    );
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse()));

    const brief = await generateGroundedBrief(
      company,
      unverifiedEvidence,
      provider,
    );

    expect(brief.mode).toBe('openai-grounded');
    expect(brief.generationRequiredSignalsAdded).toBe(1);
    expect(brief.risks.some(
      (item) => item.state === 'unverified' && item.sourceIds.includes('slack-systemrule'),
    )).toBe(true);
    expect(brief.risks[0]?.citations?.[0]?.excerpt).toBe(
      'The customer renewal risk needs review.',
    );
  });

  it('keeps a server-added risk within the final section limit', async () => {
    const sections = validSections();
    sections.risks = [
      sections.risks[0]!,
      {
        text: 'The renewal risk remains open.',
        sourceIds: ['slack-systemrule'],
        evidenceQuotes: [{
          sourceId: 'slack-systemrule',
          quote: 'The customer renewal risk needs review.',
        }],
        state: 'confirmed',
      },
      {
        text: 'The customer risk needs action.',
        sourceIds: ['slack-systemrule'],
        evidenceQuotes: [{
          sourceId: 'slack-systemrule',
          quote: 'The customer renewal risk needs review.',
        }],
        state: 'confirmed',
      },
    ];
    const unverifiedEvidence = evidence.map((record) =>
      record.id === 'slack-systemrule'
        ? { ...record, verificationStatus: 'unverified' }
        : record,
    );
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, unverifiedEvidence, provider);

    expect(brief.mode).toBe('openai-grounded');
    expect(brief.risks).toHaveLength(3);
    expect(brief.generationRequiredSignalsAdded).toBe(1);
  });

  it.each([
    'Invest in this company.',
    'Do not invest in this company.',
    'We recommend funding this company.',
    'This is an attractive investment.',
    'This company is a buy.',
  ])('uses the fallback for the recommendation: %s', async (text) => {
    const sections = validSections();
    sections.risks[0]!.text = text;
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockResolvedValue(successfulResponse(sections)));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe('investment_recommendation');
  });

  it('rejects an unsafe local fallback', async () => {
    const unsafeEvidence = evidence.map((record, index) => index === 0
      ? {
          ...record,
          content: 'Invest in this company.',
          normalizedContent: 'Invest in this company.',
        }
      : record);
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockRejectedValue(new Error('The provider is not available.')));

    await expect(generateGroundedBrief(
      company,
      unsafeEvidence,
      provider,
    )).rejects.toThrow('investment recommendation');
  });

  it.each([
    [
      'a timeout',
      new BriefGenerationFailure(
        'timeout',
        'The brief generation request reached its time limit.',
      ),
      'timeout',
    ],
    [
      'a provider error',
      new Error('The provider is not available.'),
      'api_error',
    ],
  ] as const)('uses the fallback after %s', async (_name, error, reason) => {
    const provider = providerWith(vi.fn<BriefGenerationProvider['generate']>()
      .mockRejectedValue(error));

    const brief = await generateGroundedBrief(company, evidence, provider);

    expect(brief.mode).toBe('evidence-fallback');
    expect(brief.generationFallbackReason).toBe(reason);
  });

  it('rejects cross-company evidence before it calls the provider', async () => {
    const generate = vi.fn<BriefGenerationProvider['generate']>();
    const mixedEvidence = [
      evidence[0]!,
      { ...evidence[1]!, companyId: 'cmp_othercompany' },
    ];

    await expect(generateGroundedBrief(
      company,
      mixedEvidence,
      providerWith(generate),
    )).rejects.toThrow('different company');
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('OpenAI brief generation provider', () => {
  it('uses the required request settings and excludes private source fields', async () => {
    const parse = vi.fn().mockResolvedValue({
      id: 'resp_openai_test',
      status: 'completed',
      output: [],
      output_parsed: validSections(),
      usage: { input_tokens: 230, output_tokens: 100 },
    });
    const provider = createOpenAiBriefGenerationProvider({
      apiKey: 'test-key',
      client: { responses: { parse } } as never,
    });

    await provider.generate({
      company,
      evidence,
      timeoutMs: 8_000,
    });

    const request = parse.mock.calls[0]?.[0];
    const options = parse.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      model: BRIEF_GENERATION_MODEL,
      max_output_tokens: BRIEF_GENERATION_MAX_OUTPUT_TOKENS,
      reasoning: { effort: BRIEF_GENERATION_REASONING_EFFORT },
      store: false,
      parallel_tool_calls: false,
      tools: [],
      text: {
        format: {
          name: 'grounded_company_brief',
          strict: true,
          type: 'json_schema',
        },
        verbosity: 'low',
      },
    });
    expect(options).toEqual({ maxRetries: 0, timeout: 8_000 });
    expect(request.input).not.toContain('RAW-CONTENT-SENTINEL');
    expect(request.input).not.toContain('LOCATOR-SENTINEL');
    const input = JSON.parse(request.input);
    expect(input.evidence[0]).not.toHaveProperty('rawContent');
    expect(input.evidence[0]).not.toHaveProperty('locator');
    expect(input.evidence[0]).toMatchObject({
      id: 'meeting-systemrule',
      content: evidence[0]?.normalizedContent,
    });
  });
});
