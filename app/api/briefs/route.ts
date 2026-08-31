import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildBrief, recordBriefRun, validateCitations } from '@/lib/brief';
import { getCompany } from '@/lib/companies';
import {
  assertCompanyIsolation,
  DEFAULT_RETRIEVAL_QUERY,
  retrieveEvidence,
} from '@/lib/retrieval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  companyId: z.string().regex(/^cmp_[a-z0-9]+$/),
});

export async function POST(request: Request) {
  const start = performance.now();
  try {
    const { companyId } = requestSchema.parse(await request.json());
    const company = await getCompany(companyId);
    if (!company) {
      return NextResponse.json({ error: 'The company does not exist.' }, { status: 404 });
    }
    const evidence = await retrieveEvidence(companyId, DEFAULT_RETRIEVAL_QUERY);
    assertCompanyIsolation(companyId, evidence);
    if (!evidence.length) {
      return NextResponse.json(
        { error: 'The company does not have imported evidence.' },
        { status: 422 },
      );
    }
    const brief = buildBrief(company, evidence);
    brief.durationMs = Math.round(performance.now() - start);
    validateCitations(brief);
    const briefRunId = await recordBriefRun(brief, evidence);
    return NextResponse.json({ ...brief, briefRunId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'The brief request is not valid.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: 'The brief could not be prepared.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
