import { z } from 'zod';
import type {
  BriefItem,
  BriefResult,
  FeedbackSection,
  FeedbackType,
} from '@/lib/types';

const briefTargetSchema = z.object({
  type: z.literal('brief'),
}).strict();

const statementTargetSchema = z.object({
  type: z.literal('statement'),
  statementId: z.string().trim().min(1).max(120),
}).strict();

export const feedbackRequestSchema = z.object({
  companyId: z.string().regex(/^cmp_[a-z0-9]+$/),
  briefRunId: z.string().uuid(),
  target: z.discriminatedUnion('type', [briefTargetSchema, statementTargetSchema]),
  feedbackType: z.enum(['good', 'bad', 'wrong']),
  note: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, context) => {
  if (value.feedbackType === 'wrong' && !value.note) {
    context.addIssue({
      code: 'custom',
      message: 'Explain what is wrong.',
      path: ['note'],
    });
  }
});

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export interface FeedbackStatementSnapshot {
  statementId: string;
  statementText: string;
  statementSection: FeedbackSection;
  statementKind: BriefItem['kind'];
  sourceIds: string[];
}

export function feedbackPriority(feedbackType: FeedbackType) {
  if (feedbackType === 'good') return 'low' as const;
  if (feedbackType === 'wrong') return 'high' as const;
  return 'normal' as const;
}

export function findFeedbackStatement(
  brief: BriefResult,
  statementId: string,
): FeedbackStatementSnapshot | null {
  const sections: Array<{
    name: FeedbackSection;
    items: BriefItem[];
  }> = [
    { name: 'key_facts', items: [...brief.currentState, ...brief.changes] },
    { name: 'risks', items: brief.risks },
    { name: 'questions', items: [...brief.openQuestions, ...brief.suggestedQuestions] },
  ];
  const matches = sections.flatMap(({ name, items }) =>
    items
      .filter((item) => item.id === statementId)
      .map((item) => ({ name, item })),
  );
  if (matches.length !== 1) return null;
  const [{ name, item }] = matches;
  return {
    statementId: item.id,
    statementText: item.text,
    statementSection: name,
    statementKind: item.kind,
    sourceIds: item.sourceIds,
  };
}
