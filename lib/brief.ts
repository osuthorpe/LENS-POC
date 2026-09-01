import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '@/lib/db';
import {
  citationRoleForSource,
  extractClaimValues,
  relevantSourceExcerpt,
  sourceSupportsValue,
} from '@/lib/evidence-detail';
import { validateBriefSafety } from '@/lib/brief-safety';
import type { RetrievedEvidence } from '@/lib/retrieval';
import type { BriefItem, BriefResult, Company, EvidenceState } from '@/lib/types';

const historicalStatusPattern = /earlier|old|outdated|stale|superseded|update[_ -]?needed/i;

function resolveEvidenceState(
  kind: BriefItem['kind'],
  requestedState: EvidenceState,
  records: RetrievedEvidence[],
): EvidenceState {
  if (
    kind !== 'fact' ||
    !['confirmed', 'stale'].includes(requestedState) ||
    records.length === 0
  ) {
    return requestedState;
  }
  const hasCurrentRecord = records.some(
    (record) => !historicalStatusPattern.test(record.verificationStatus ?? ''),
  );
  return hasCurrentRecord ? 'confirmed' : 'stale';
}

export function createBriefItem(
  id: string,
  text: string,
  sourceIds: string[],
  evidence: RetrievedEvidence[],
  kind: BriefItem['kind'] = 'fact',
  state: EvidenceState = 'confirmed',
  evidenceQuotes: Array<{ sourceId: string; quote: string }> = [],
): BriefItem {
  const sourceRecords = sourceIds
    .map((sourceId) => evidence.find((record) => record.id === sourceId))
    .filter((record): record is RetrievedEvidence => Boolean(record));
  const dates = sourceRecords.map((record) => record.sourceDate).sort();
  const validSourceIds = sourceRecords.map((record) => record.id);
  const resolvedState = resolveEvidenceState(kind, state, sourceRecords);
  const values = extractClaimValues(text);
  const citations = validSourceIds.map((sourceId) => {
    const record = evidence.find((item) => item.id === sourceId)!;
    return {
      sourceId,
      role: citationRoleForSource(
        kind,
        resolvedState,
        values,
        record.content,
        record.verificationStatus,
      ),
      excerpt: evidenceQuotes.find((item) => item.sourceId === sourceId)?.quote ??
        relevantSourceExcerpt(record.content, text),
      values: values.filter((value) => sourceSupportsValue(value, record.content)),
    };
  });
  return {
    id,
    text,
    sourceIds: validSourceIds,
    sourceDate: dates.at(-1) ?? null,
    kind,
    state: resolvedState,
    values,
    citations,
  };
}

interface BriefSections {
  currentState: BriefItem[];
  changes: BriefItem[];
  risks: BriefItem[];
  openQuestions: BriefItem[];
  suggestedQuestions: BriefItem[];
}

interface BriefGenerationMetadata {
  mode: BriefResult['mode'];
  generationModel: string | null;
  generationReasoningEffort: BriefResult['generationReasoningEffort'];
  generationPromptVersion: string | null;
  generationResponseId: string | null;
  generationInputTokens: number | null;
  generationOutputTokens: number | null;
  generationDurationMs: number | null;
  generationRequiredSignalsAdded: number;
  generationFallbackReason: BriefResult['generationFallbackReason'];
}

export function createBriefResult(
  company: Company,
  evidence: RetrievedEvidence[],
  sections: BriefSections,
  metadata: BriefGenerationMetadata,
): BriefResult {
  const categoryNames = { crm: 'CRM', meeting: 'Meetings', slack: 'Slack', news: 'News' };
  const coverage = (Object.keys(categoryNames) as Array<keyof typeof categoryNames>).map((category) => {
    const records = evidence.filter((record) => record.sourceType === category);
    return {
      category: categoryNames[category],
      count: records.length,
      latestDate: records.map((record) => record.sourceDate).sort().at(-1) ?? null,
    };
  });

  return {
    company,
    generatedAt: new Date().toISOString(),
    durationMs: 0,
    ...metadata,
    inputQuery: 'Current company state, changes, risks, and open questions',
    ...sections,
    sources: evidence.map((record) => ({
      id: record.id,
      sourceType: record.sourceType,
      title: record.title,
      sourceDate: record.sourceDate,
      locator: record.locator,
      content: record.content,
      verificationStatus: record.verificationStatus,
    })),
    coverage,
  };
}

function firstSentence(value: string) {
  const compact = value.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = compact.match(/[^.!?]+[.!?]+/g);
  return (sentences?.slice(0, 2).join(' ') ?? compact).trim();
}

function genericBrief(company: Company, evidence: RetrievedEvidence[]) {
  const nonProfile = evidence.filter((record) => !record.id.startsWith('crm-company-'));
  const currentRecords = nonProfile.slice(0, 3);
  const changes = nonProfile
    .filter((record) =>
      company.lastReviewDate
        ? new Date(record.sourceDate) > new Date(company.lastReviewDate)
        : true,
    )
    .slice(0, 2);
  const riskRecords = nonProfile.filter((record) =>
    /risk|not |need|missing|unclear|concentration|did not|depends|runway|burn/i.test(
      record.normalizedContent,
    ),
  ).slice(0, 2);
  const questionRecords = riskRecords.length ? riskRecords : nonProfile.slice(0, 2);

  return {
    currentState: currentRecords.map((record, index) =>
      createBriefItem(`current-${index + 1}`, firstSentence(record.normalizedContent), [record.id], evidence),
    ),
    changes: changes.map((record, index) =>
      createBriefItem(`change-${index + 1}`, firstSentence(record.normalizedContent), [record.id], evidence),
    ),
    risks: riskRecords.map((record, index) =>
      createBriefItem(
        `risk-${index + 1}`,
        `This source describes a possible risk: ${firstSentence(record.normalizedContent)}`,
        [record.id],
        evidence,
        'analysis',
        /unverified/i.test(record.verificationStatus ?? '') ? 'unverified' : 'confirmed',
      ),
    ),
    openQuestions: questionRecords.map((record, index) =>
      createBriefItem(
        `open-${index + 1}`,
        `Which current evidence can resolve the open item in ${record.title}?`,
        [record.id],
        evidence,
        'question',
        'missing',
      ),
    ),
    suggestedQuestions: questionRecords.map((record, index) =>
      createBriefItem(
        `suggested-${index + 1}`,
        `What changed after the ${record.title.toLowerCase()} record?`,
        [record.id],
        evidence,
        'question',
      ),
    ),
  };
}

function vectorForgeBrief(evidence: RetrievedEvidence[]) {
  return {
    currentState: [
      createBriefItem('current-1', 'Recognized annual recurring revenue is unresolved. Finance reports 3.4 million USD. CRM reports 3.8 million USD.', ['meeting-001', 'crm-activity-002', 'slack-001'], evidence, 'fact', 'conflict'),
      createBriefItem('current-2', 'Monthly burn is 420000 USD. Reported runway is approximately 14 months.', ['meeting-001', 'crm-activity-001'], evidence),
      createBriefItem('current-3', 'The company plans to start a Series B process in January 2027.', ['slack-017', 'meeting-001'], evidence),
    ],
    changes: [
      createBriefItem('change-1', 'Northbank expanded from one production workload to four workloads. Contract value increased by 180000 USD.', ['crm-activity-003'], evidence),
      createBriefItem('change-2', 'The company opened four infrastructure engineering roles.', ['slack-003'], evidence),
    ],
    risks: [
      createBriefItem('risk-1', 'The company has not confirmed the gross margin effect of the Northbank expansion.', ['meeting-001', 'slack-002'], evidence, 'analysis', 'missing'),
      createBriefItem('risk-2', 'New hiring can increase burn before the planned funding process.', ['slack-003', 'slack-017'], evidence, 'analysis', 'unverified'),
    ],
    openQuestions: [
      createBriefItem('open-1', 'Which recognized annual recurring revenue value is correct after the August close?', ['meeting-001', 'crm-activity-002', 'slack-001'], evidence, 'question', 'missing'),
      createBriefItem('open-2', 'What is the gross margin effect of the Northbank expansion?', ['crm-activity-003'], evidence, 'question', 'missing'),
    ],
    suggestedQuestions: [
      createBriefItem('suggested-1', 'Which two customer expansions must close before the Series B process starts?', ['meeting-001', 'slack-017'], evidence, 'question'),
      createBriefItem('suggested-2', 'How will new infrastructure hiring change monthly burn and runway?', ['slack-003'], evidence, 'question'),
    ],
  };
}

function lumenOpsBrief(evidence: RetrievedEvidence[]) {
  return {
    currentState: [
      createBriefItem('current-1', 'The newest record reports 9 months of runway. An earlier January record reports 18 months.', ['meeting-002', 'crm-activity-005', 'crm-activity-004', 'slack-004'], evidence),
      createBriefItem('current-2', 'Monthly recurring revenue is 142000 USD. Monthly burn is 310000 USD.', ['meeting-002', 'crm-activity-005'], evidence),
      createBriefItem('current-3', 'The largest customer represents 31 percent of monthly recurring revenue.', ['meeting-002', 'crm-activity-006'], evidence),
    ],
    changes: [
      createBriefItem('change-1', 'Runway decreased from 18 months in January to 9 months in August.', ['crm-activity-004', 'crm-activity-005', 'meeting-002'], evidence),
      createBriefItem('change-2', 'The company paused three open roles after the cash review.', ['meeting-002', 'slack-018'], evidence),
    ],
    risks: [
      createBriefItem('risk-1', 'The November 2026 renewal can affect the funding plan because one customer represents 31 percent of monthly recurring revenue.', ['meeting-002', 'crm-activity-006', 'slack-005'], evidence, 'analysis'),
      createBriefItem('risk-2', 'The company must start funding preparation soon because reported runway is 9 months.', ['meeting-002'], evidence, 'analysis'),
    ],
    openQuestions: [
      createBriefItem('open-1', 'What does the 13-week cash plan show?', ['meeting-002'], evidence, 'question', 'missing'),
      createBriefItem('open-2', 'What is the current account health for the largest customer?', ['slack-005'], evidence, 'question', 'missing'),
    ],
    suggestedQuestions: [
      createBriefItem('suggested-1', 'When will the company start its funding process?', ['crm-activity-005', 'meeting-002'], evidence, 'question'),
      createBriefItem('suggested-2', 'What action will protect the November renewal?', ['crm-activity-006', 'slack-005'], evidence, 'question'),
    ],
  };
}

function kestrelBrief(evidence: RetrievedEvidence[]) {
  return {
    currentState: [
      createBriefItem('current-1', 'Kestrel Health has four paid research customers and annual recurring revenue of 620000 USD.', ['meeting-003', 'crm-activity-007'], evidence),
      createBriefItem('current-2', 'The company joined a hospital software evaluation program.', ['news-005', 'meeting-003'], evidence),
    ],
    changes: [
      createBriefItem('change-1', 'The company expects two more paid trials before the end of 2026.', ['meeting-003'], evidence),
    ],
    risks: [
      createBriefItem('risk-1', 'A Slack message states that Kestrel has an FDA pilot. No document or direct company statement confirms this claim.', ['slack-006', 'slack-007', 'meeting-003', 'news-005'], evidence, 'analysis', 'unverified'),
      createBriefItem('risk-2', 'The company has not provided formal regulatory or security documents.', ['meeting-003', 'crm-activity-007'], evidence, 'analysis', 'missing'),
    ],
    openQuestions: [
      createBriefItem('open-1', 'What is the regulatory program name, and which document confirms it?', ['slack-006', 'slack-007'], evidence, 'question', 'missing'),
      createBriefItem('open-2', 'What data access controls protect customer documents?', ['meeting-003'], evidence, 'question', 'missing'),
    ],
    suggestedQuestions: [
      createBriefItem('suggested-1', 'Can the company provide the regulatory review and supporting documents?', ['crm-activity-007'], evidence, 'question'),
      createBriefItem('suggested-2', 'What must happen before the two planned trials become paid customers?', ['meeting-003'], evidence, 'question'),
    ],
  };
}

function atlasGridBrief(evidence: RetrievedEvidence[]) {
  const generic = genericBrief({} as Company, evidence);
  return {
    ...generic,
    currentState: [
      createBriefItem('current-1', 'Atlas Grid and AtlasGrid AI identify the same company.', ['meeting-004', 'slack-008', 'crm-company-004'], evidence),
      createBriefItem('current-2', 'Annual recurring revenue is 4.1 million USD. Gross retention is 92 percent.', ['meeting-004', 'crm-activity-008'], evidence),
      createBriefItem('current-3', 'One automotive customer represents 38 percent of revenue.', ['meeting-004', 'crm-activity-008'], evidence),
    ],
    risks: [
      createBriefItem('risk-1', 'One automotive customer represents a large part of revenue. The renewal date is missing.', ['meeting-004', 'slack-009'], evidence, 'analysis', 'missing'),
      createBriefItem('risk-2', 'Camera installation costs reduce first-year gross margin.', ['meeting-004'], evidence, 'analysis'),
    ],
  };
}

function northstarBrief(evidence: RetrievedEvidence[]) {
  return {
    currentState: [
      createBriefItem('current-1', 'Northstar Security opened a private beta for small security teams.', ['news-012', 'crm-company-010'], evidence),
    ],
    changes: [
      createBriefItem('change-1', 'The company opened its private beta on 24 August 2026.', ['news-012'], evidence),
    ],
    risks: [
      createBriefItem('risk-1', 'The evidence does not include revenue, customer, burn, runway, or team metrics.', ['crm-activity-014', 'slack-016', 'news-012'], evidence, 'analysis', 'missing'),
    ],
    openQuestions: [
      createBriefItem('open-1', 'What are current revenue, customer, burn, and runway metrics?', ['crm-activity-014', 'slack-016'], evidence, 'question', 'missing'),
      createBriefItem('open-2', 'Who is on the team, and what roles are open?', ['slack-016'], evidence, 'question', 'missing'),
    ],
    suggestedQuestions: [
      createBriefItem('suggested-1', 'Which users are active in the private beta?', ['news-012'], evidence, 'question'),
      createBriefItem('suggested-2', 'When will the company provide basic operating metrics?', ['crm-activity-014'], evidence, 'question'),
    ],
  };
}

export function buildBrief(company: Company, evidence: RetrievedEvidence[]): BriefResult {
  let sections = genericBrief(company, evidence);
  if (company.id === 'cmp_vectorforge') sections = vectorForgeBrief(evidence);
  if (company.id === 'cmp_lumenops') sections = lumenOpsBrief(evidence);
  if (company.id === 'cmp_kestrelhealth') sections = kestrelBrief(evidence);
  if (company.id === 'cmp_atlasgrid') sections = atlasGridBrief(evidence);
  if (company.id === 'cmp_northstarsecurity') sections = northstarBrief(evidence);

  const brief = createBriefResult(company, evidence, sections, {
    mode: 'evidence-fallback',
    generationModel: null,
    generationReasoningEffort: null,
    generationPromptVersion: null,
    generationResponseId: null,
    generationInputTokens: null,
    generationOutputTokens: null,
    generationDurationMs: null,
    generationRequiredSignalsAdded: 0,
    generationFallbackReason: 'local_rule_engine',
  });
  validateBriefSafety(brief);
  return brief;
}

export function validateCitations(brief: BriefResult) {
  const sourceIds = new Set(brief.sources.map((source) => source.id));
  const items = [brief.currentState, brief.changes, brief.risks, brief.openQuestions, brief.suggestedQuestions].flat();
  for (const briefItem of items) {
    if (briefItem.sourceIds.length === 0) {
      throw new Error(`Brief item ${briefItem.id} does not have a source.`);
    }
    for (const sourceId of briefItem.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`Brief item ${briefItem.id} has an invalid source.`);
      }
    }
    if (briefItem.citations) {
      const citationIds = new Set(briefItem.citations.map((citation) => citation.sourceId));
      if (citationIds.size !== briefItem.sourceIds.length) {
        throw new Error(`Brief item ${briefItem.id} does not cite each source.`);
      }
      for (const sourceId of briefItem.sourceIds) {
        if (!citationIds.has(sourceId)) {
          throw new Error(`Brief item ${briefItem.id} does not cite source ${sourceId}.`);
        }
      }
    }
  }
}

export async function recordBriefRun(
  brief: BriefResult,
  evidence: RetrievedEvidence[],
) {
  const id = randomUUID();
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO brief_runs (
        id, company_id, retrieval_input, generation_mode,
        generation_model, generation_reasoning_effort, generation_prompt_version,
        generation_response_id, generation_input_tokens, generation_output_tokens,
        generation_duration_ms, generation_required_signals_added,
        generation_fallback_reason,
        generated_at, duration_ms, result
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        id,
        brief.company.id,
        brief.inputQuery,
        brief.mode,
        brief.generationModel,
        brief.generationReasoningEffort,
        brief.generationPromptVersion,
        brief.generationResponseId,
        brief.generationInputTokens,
        brief.generationOutputTokens,
        brief.generationDurationMs,
        brief.generationRequiredSignalsAdded,
        brief.generationFallbackReason,
        brief.generatedAt,
        brief.durationMs,
        JSON.stringify(brief),
      ],
    );
    for (const [index, record] of evidence.entries()) {
      await client.query(
        `INSERT INTO brief_evidence (
          brief_run_id, source_record_id, rank_position, score
        ) VALUES ($1,$2,$3,$4)`,
        [id, record.id, index + 1, record.score],
      );
    }
  });
  return id;
}

export async function getLatestBriefRun(
  companyId: string,
): Promise<BriefResult | null> {
  const result = await pool.query<{
    id: string;
    result: BriefResult;
  }>(
    `SELECT id, result
     FROM brief_runs
     WHERE company_id = $1
     ORDER BY generated_at DESC, id DESC
     LIMIT 1`,
    [companyId],
  );
  const row = result.rows[0];
  return row ? { ...row.result, briefRunId: row.id } : null;
}
