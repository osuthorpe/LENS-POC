import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/db';
import {
  feedbackPriority,
  feedbackRequestSchema,
  findFeedbackStatement,
} from '@/lib/feedback';
import type { BriefResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const input = feedbackRequestSchema.parse(await request.json());
    const run = await pool.query<{ result: BriefResult }>(
      `SELECT result
       FROM brief_runs
       WHERE id = $1 AND company_id = $2`,
      [input.briefRunId, input.companyId],
    );
    const brief = run.rows[0]?.result;
    if (!brief) {
      return NextResponse.json(
        { error: 'The saved brief does not exist.' },
        { status: 404 },
      );
    }

    const statement = input.target.type === 'statement'
      ? findFeedbackStatement(brief, input.target.statementId)
      : null;
    if (input.target.type === 'statement' && !statement) {
      return NextResponse.json(
        { error: 'The statement does not exist in this brief.' },
        { status: 404 },
      );
    }

    const id = randomUUID();
    const priority = feedbackPriority(input.feedbackType);
    const note = input.note || null;
    const result = await pool.query<{
      created_at: Date | string;
      status: 'open';
    }>(
      `INSERT INTO brief_feedback (
         id, brief_run_id, company_id, target_type,
         statement_id, statement_text, statement_section, statement_kind,
         source_record_ids, feedback_type, feedback_note, priority
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING created_at, status`,
      [
        id,
        input.briefRunId,
        input.companyId,
        input.target.type,
        statement?.statementId ?? null,
        statement?.statementText ?? null,
        statement?.statementSection ?? null,
        statement?.statementKind ?? null,
        statement?.sourceIds ?? [],
        input.feedbackType,
        note,
        priority,
      ],
    );

    return NextResponse.json({
      feedback: {
        id,
        companyId: input.companyId,
        briefRunId: input.briefRunId,
        targetType: input.target.type,
        statementId: statement?.statementId ?? null,
        feedbackType: input.feedbackType,
        priority,
        status: result.rows[0]?.status ?? 'open',
        createdAt: result.rows[0]?.created_at ?? new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'The feedback request is not valid.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'The feedback could not be saved.' },
      { status: 500 },
    );
  }
}
