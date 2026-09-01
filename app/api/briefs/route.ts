import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getLatestBriefRun,
  recordBriefRun,
  validateCitations,
} from '@/lib/brief';
import {
  BRIEF_REQUEST_BUDGET_MS,
  generateGroundedBrief,
} from '@/lib/brief-generation';
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

export async function GET(request: Request) {
  try {
    const { companyId } = requestSchema.parse({
      companyId: new URL(request.url).searchParams.get('companyId'),
    });
    const brief = await getLatestBriefRun(companyId);
    if (!brief) {
      return NextResponse.json(
        { error: 'The company does not have a saved brief.' },
        { status: 404 },
      );
    }
    return NextResponse.json(brief);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'The brief request is not valid.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'The saved brief could not be loaded.' },
      { status: 500 },
    );
  }
}

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
    const remainingTime = Math.max(
      0,
      BRIEF_REQUEST_BUDGET_MS - (performance.now() - start),
    );
    const brief = await generateGroundedBrief(
      company,
      evidence,
      undefined,
      remainingTime,
    );
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
      },
      { status: 500 },
    );
  }
}
