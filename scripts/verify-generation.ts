import { validateCitations } from '../lib/brief';
import {
  BRIEF_GENERATION_MODEL,
  generateGroundedBrief,
} from '../lib/brief-generation';
import {
  extractClaimValues,
  sourceSupportsValue,
} from '../lib/evidence-detail';
import { getCompany } from '../lib/companies';
import { pool } from '../lib/db';
import {
  assertCompanyIsolation,
  retrieveEvidence,
} from '../lib/retrieval';

type GeneratedBrief = Awaited<ReturnType<typeof generateGroundedBrief>>;
type GeneratedBriefItem = GeneratedBrief['currentState'][number];

function hasMoneyValue(text: string, expectedValue: string) {
  return extractClaimValues(text).some(
    (value) => value.kind === 'money' && sourceSupportsValue(value, expectedValue),
  );
}

function hasExactStoredQuotes(
  brief: GeneratedBrief,
  item: GeneratedBriefItem,
  sourceIds: string[],
) {
  return sourceIds.every((sourceId) => {
    const citation = item.citations?.find((entry) => entry.sourceId === sourceId);
    const source = brief.sources.find((entry) => entry.id === sourceId);
    return Boolean(citation?.excerpt && source?.content.includes(citation.excerpt));
  });
}

function directSupportingSources(
  brief: GeneratedBrief,
  item: GeneratedBriefItem,
  expectedValue: string,
) {
  const [value] = extractClaimValues(expectedValue);
  if (!value) return [];
  return item.sourceIds.filter((sourceId) => {
    const source = brief.sources.find((entry) => entry.id === sourceId);
    const citation = item.citations?.find((entry) => entry.sourceId === sourceId);
    return Boolean(
      source &&
      citation?.excerpt &&
      source.content.includes(citation.excerpt) &&
      sourceSupportsValue(value, source.content),
    );
  });
}

const targets: Array<{
  companyId: string;
  qualityCheck: (brief: GeneratedBrief) => boolean;
  qualityLabel: string;
}> = [
  {
    companyId: 'cmp_vectorforge',
    qualityCheck: (brief) => brief.currentState.some((item) => {
      if (
        item.state !== 'conflict' ||
        !hasMoneyValue(item.text, '3.4 million USD') ||
        !hasMoneyValue(item.text, '3.8 million USD')
      ) return false;
      const lowerSources = directSupportingSources(
        brief,
        item,
        '3.4 million USD',
      );
      const higherSources = directSupportingSources(
        brief,
        item,
        '3.8 million USD',
      );
      return lowerSources.some(
        (lowerSource) => higherSources.some(
          (higherSource) => higherSource !== lowerSource,
        ),
      );
    }),
    qualityLabel: 'keeps both revenue values with two direct source quotes',
  },
  {
    companyId: 'cmp_kestrelhealth',
    qualityCheck: (brief) => brief.risks.some((item) =>
      item.state === 'unverified' &&
      item.sourceIds.includes('slack-006') &&
      hasExactStoredQuotes(brief, item, ['slack-006'])
    ),
    qualityLabel: 'keeps the FDA claim with its exact source quote',
  },
];

const results: Array<{
  company: string;
  mode: string;
  model: string;
  duration: string;
  citations: string;
  quality: string;
  modelSignal: string;
  fallback: string;
  requiredSignalsAdded: number;
}> = [];

try {
  for (const target of targets) {
    const company = await getCompany(target.companyId);
    if (!company) throw new Error(`Company ${target.companyId} does not exist.`);

    const started = performance.now();
    const evidence = await retrieveEvidence(company.id);
    assertCompanyIsolation(company.id, evidence);
    const brief = await generateGroundedBrief(company, evidence);
    validateCitations(brief);
    const durationMs = Math.round(performance.now() - started);
    const generated = brief.mode === 'openai-grounded';
    const withinTime = durationMs < 30_000;
    const qualityPassed = target.qualityCheck(brief);
    const modelSignalPassed = brief.generationRequiredSignalsAdded === 0;

    results.push({
      company: company.name,
      mode: brief.mode,
      model: brief.generationModel ?? 'none',
      duration: `${durationMs} ms`,
      citations: 'passed',
      quality: qualityPassed ? target.qualityLabel : 'failed',
      modelSignal: modelSignalPassed ? 'passed' : 'server control added a signal',
      fallback: brief.generationFallbackReason ?? 'none',
      requiredSignalsAdded: brief.generationRequiredSignalsAdded,
    });

    if (!generated || !withinTime || !qualityPassed || !modelSignalPassed) {
      process.exitCode = 1;
    }
  }

  if (results.some((result) => result.model !== BRIEF_GENERATION_MODEL)) {
    process.exitCode = 1;
  }
  console.table(results);
} finally {
  await pool.end();
}
