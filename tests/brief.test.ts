import { describe, expect, it } from 'vitest';
import { buildBrief, validateCitations } from '@/lib/brief';
import { fallbackCompanies } from '@/lib/fallback-data';
import { assertCompanyIsolation, type RetrievedEvidence } from '@/lib/retrieval';

function evidence(
  companyId: string,
  ids: string[],
): RetrievedEvidence[] {
  return ids.map((id, index) => ({
    id,
    companyId,
    sourceType: id.startsWith('meeting')
      ? 'meeting'
      : id.startsWith('slack')
        ? 'slack'
        : id.startsWith('news')
          ? 'news'
          : 'crm',
    title: id,
    sourceDate: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
    locator: id,
    content: `Evidence content for ${id}.`,
    normalizedContent: `Evidence content for ${id}.`,
    rawContent: {},
    verificationStatus: id === 'slack-006' ? 'unverified' : 'confirmed',
    score: 1 - index / 100,
    sourceQuality: 0.9,
  }));
}

describe('brief rules', () => {
  it('shows the unresolved VectorForge revenue conflict with valid citations', () => {
    const company = fallbackCompanies.find((item) => item.id === 'cmp_vectorforge')!;
    const records = evidence(company.id, [
      'meeting-001', 'crm-activity-002', 'slack-001', 'crm-activity-001',
      'slack-017', 'crm-activity-003', 'slack-003', 'slack-002',
    ]);
    const financeRecord = records.find((record) => record.id === 'meeting-001')!;
    financeRecord.content = 'Finance reports recognized annual recurring revenue of 3.4 million USD.';
    financeRecord.normalizedContent = financeRecord.content;
    const crmRecord = records.find((record) => record.id === 'crm-activity-002')!;
    crmRecord.content = 'CRM reports recognized annual recurring revenue of 3.8 million USD.';
    crmRecord.normalizedContent = crmRecord.content;
    const reconciliationRecord = records.find((record) => record.id === 'slack-001')!;
    reconciliationRecord.content = 'Finance reports 3.4 million USD. CRM reports 3.8 million USD. The values are not reconciled.';
    reconciliationRecord.normalizedContent = reconciliationRecord.content;
    const brief = buildBrief(company, records);
    expect(brief.currentState.some((item) => item.state === 'conflict')).toBe(true);
    expect(brief.currentState.every((item) => item.citations?.length === item.sourceIds.length)).toBe(true);
    expect(
      brief.currentState[0].citations?.find((citation) => citation.sourceId === 'meeting-001')?.role,
    ).toBe('supports');
    expect(
      brief.currentState[0].citations?.find((citation) => citation.sourceId === 'crm-activity-002')?.role,
    ).toBe('conflicts');
    expect(
      brief.currentState[0].citations?.find((citation) => citation.sourceId === 'slack-001')?.role,
    ).toBe('context');
    expect(() => validateCitations(brief)).not.toThrow();
  });

  it('shows the LumenOps runway history', () => {
    const company = fallbackCompanies.find((item) => item.id === 'cmp_lumenops')!;
    const records = evidence(company.id, [
      'meeting-002', 'crm-activity-005', 'crm-activity-004', 'slack-004',
      'crm-activity-006', 'slack-018', 'slack-005',
    ]);
    const brief = buildBrief(company, records);
    expect(brief.currentState.some((item) => item.text.includes('newest record'))).toBe(true);
    expect(brief.changes.some((item) => item.text.includes('18 months') && item.text.includes('9 months'))).toBe(true);
    expect(brief.changes.some((item) => item.state === 'stale')).toBe(true);
  });

  it('keeps the Kestrel FDA claim unverified', () => {
    const company = fallbackCompanies.find((item) => item.id === 'cmp_kestrelhealth')!;
    const records = evidence(company.id, [
      'meeting-003', 'crm-activity-007', 'news-005', 'slack-006', 'slack-007',
    ]);
    const brief = buildBrief(company, records);
    expect(brief.risks.some((item) => item.state === 'unverified')).toBe(true);
  });

  it('shows missing Northstar metrics', () => {
    const company = fallbackCompanies.find((item) => item.id === 'cmp_northstarsecurity')!;
    const records = evidence(company.id, [
      'news-012', 'crm-company-010', 'crm-activity-014', 'slack-016',
    ]);
    const brief = buildBrief(company, records);
    expect(brief.risks.some((item) => item.state === 'missing')).toBe(true);
  });

  it('rejects evidence from a different company', () => {
    const records = evidence('cmp_lumenops', ['slack-004']);
    expect(() => assertCompanyIsolation('cmp_vectorforge', records)).toThrow(
      'different company',
    );
  });
});
