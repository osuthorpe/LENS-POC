import { buildBrief, validateCitations } from '../lib/brief';
import { getCompanies } from '../lib/companies';
import { pool } from '../lib/db';
import {
  assertCompanyIsolation,
  retrieveEvidence,
} from '../lib/retrieval';

const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

try {
  const database = await pool.query<{
    company_count: string;
    record_count: string;
    chunk_count: string;
    vector_count: string;
    feedback_table: string | null;
    feedback_company_guard: string;
  }>(`SELECT
    (SELECT COUNT(*) FROM companies)::text AS company_count,
    (SELECT COUNT(*) FROM source_records)::text AS record_count,
    (SELECT COUNT(*) FROM document_chunks)::text AS chunk_count,
    (SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL)::text AS vector_count,
    to_regclass('public.brief_feedback')::text AS feedback_table,
    (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'brief_feedback_run_company_fk')::text AS feedback_company_guard`);
  const counts = database.rows[0];
  checks.push({
    name: 'Demo data size',
    passed: counts?.company_count === '10' && counts.record_count === '59',
    detail: `${counts?.company_count} companies and ${counts?.record_count} records`,
  });
  checks.push({
    name: 'Vector coverage',
    passed: counts?.chunk_count === counts?.vector_count,
    detail: `${counts?.vector_count} of ${counts?.chunk_count} chunks have vectors`,
  });
  checks.push({
    name: 'Feedback review queue',
    passed: counts?.feedback_table === 'brief_feedback' && counts.feedback_company_guard === '1',
    detail: 'The queue links each item to one saved brief and company.',
  });

  const companies = await getCompanies();
  const briefs = new Map();
  for (const company of companies) {
    const started = performance.now();
    const evidence = await retrieveEvidence(company.id);
    assertCompanyIsolation(company.id, evidence);
    const brief = buildBrief(company, evidence);
    validateCitations(brief);
    const duration = Math.round(performance.now() - started);
    briefs.set(company.id, brief);
    checks.push({
      name: `${company.name} brief`,
      passed: duration < 30000 && evidence.length > 0,
      detail: `${duration} ms with ${evidence.length} evidence records`,
    });
  }

  const vectorForge = briefs.get('cmp_vectorforge');
  checks.push({
    name: 'VectorForge conflict',
    passed: vectorForge.currentState.some((entry: { state: string }) => entry.state === 'conflict'),
    detail: 'The brief keeps both revenue values.',
  });
  const lumenOps = briefs.get('cmp_lumenops');
  const runwayHistory = lumenOps.changes.find(
    (entry: { text: string }) => entry.text.includes('18 months') && entry.text.includes('9 months'),
  );
  checks.push({
    name: 'LumenOps runway history',
    passed: runwayHistory?.state === 'confirmed' && runwayHistory.citations?.some(
      (citation: { role: string }) => citation.role === 'earlier',
    ),
    detail: 'The brief uses the current value and keeps the earlier value in Evidence.',
  });
  const kestrel = briefs.get('cmp_kestrelhealth');
  checks.push({
    name: 'Kestrel unverified claim',
    passed: kestrel.risks.some((entry: { state: string }) => entry.state === 'unverified'),
    detail: 'The brief does not state the FDA claim as a fact.',
  });
  const northstar = briefs.get('cmp_northstarsecurity');
  checks.push({
    name: 'Northstar missing data',
    passed: northstar.risks.some((entry: { state: string }) => entry.state === 'missing'),
    detail: 'The brief shows missing company metrics.',
  });

  console.table(checks);
  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
