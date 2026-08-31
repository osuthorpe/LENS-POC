import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

import { POST } from '@/app/api/feedback/route';
import { pool } from '@/lib/db';
import { fallbackBrief } from '@/lib/fallback-data';
import { feedbackPriority, feedbackRequestSchema } from '@/lib/feedback';

const query = vi.mocked(pool.query);
const briefRunId = '00000000-0000-4000-8000-000000000001';

function request(body: unknown) {
  return POST(new Request('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe('feedback route', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('assigns triage priority on the server', () => {
    expect(feedbackPriority('good')).toBe('low');
    expect(feedbackPriority('bad')).toBe('normal');
    expect(feedbackPriority('wrong')).toBe('high');
  });

  it('requires a note when information is wrong', async () => {
    const response = await request({
      companyId: 'cmp_vectorforge',
      briefRunId,
      target: { type: 'statement', statementId: 'current-1' },
      feedbackType: 'wrong',
    });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects fields that the end user must not set', () => {
    expect(() => feedbackRequestSchema.parse({
      companyId: 'cmp_vectorforge',
      briefRunId,
      target: { type: 'brief' },
      feedbackType: 'good',
      priority: 'high',
    })).toThrow();
  });

  it('does not accept a brief from a different company', async () => {
    query.mockResolvedValueOnce({ rows: [] } as never);
    const response = await request({
      companyId: 'cmp_lumenops',
      briefRunId,
      target: { type: 'brief' },
      feedbackType: 'bad',
    });
    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND company_id = $2'),
      [briefRunId, 'cmp_lumenops'],
    );
  });

  it('stores the saved statement text and opens a high-priority review item', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ result: fallbackBrief }] } as never)
      .mockResolvedValueOnce({
        rows: [{ created_at: '2026-08-31T18:00:00Z', status: 'open' }],
      } as never);
    const response = await request({
      companyId: 'cmp_vectorforge',
      briefRunId,
      target: { type: 'statement', statementId: 'current-1' },
      feedbackType: 'wrong',
      note: 'The August close replaced this value.',
    });
    const body = await response.json();
    const insertValues = query.mock.calls[1]?.[1] as unknown[];
    expect(response.status).toBe(201);
    expect(query.mock.calls[1]?.[0]).toContain('INSERT INTO brief_feedback');
    expect(insertValues[5]).toBe(fallbackBrief.currentState[0].text);
    expect(insertValues[8]).toEqual(fallbackBrief.currentState[0].sourceIds);
    expect(insertValues[11]).toBe('high');
    expect(body.feedback.status).toBe('open');
    expect(body.feedback.priority).toBe('high');
  });

  it('rejects a statement that is not in the saved brief', async () => {
    query.mockResolvedValueOnce({ rows: [{ result: fallbackBrief }] } as never);
    const response = await request({
      companyId: 'cmp_vectorforge',
      briefRunId,
      target: { type: 'statement', statementId: 'missing-statement' },
      feedbackType: 'bad',
    });
    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
