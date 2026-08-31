'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { CircleAlert, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDisplayNumbers } from '@/lib/display-format';
import type { FeedbackTarget, FeedbackType } from '@/lib/types';

const choices: Array<{
  type: FeedbackType;
  label: string;
  description: string;
  icon: typeof ThumbsUp;
}> = [
  {
    type: 'good',
    label: 'Good',
    description: 'Useful and correct',
    icon: ThumbsUp,
  },
  {
    type: 'bad',
    label: 'Bad',
    description: 'Unclear or not useful',
    icon: ThumbsDown,
  },
  {
    type: 'wrong',
    label: 'Wrong',
    description: 'Incorrect information',
    icon: CircleAlert,
  },
];

export function FeedbackDialog({
  target,
  companyId,
  briefRunId,
  onOpenChange,
}: {
  target: FeedbackTarget | null;
  companyId: string;
  briefRunId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  function updateOpen(open: boolean) {
    if (!open && status === 'sending') return;
    onOpenChange(open);
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || !feedbackType || !briefRunId || status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          briefRunId,
          target: target.type === 'brief'
            ? { type: 'brief' }
            : { type: 'statement', statementId: target.statementId },
          feedbackType,
          note: note.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error('The feedback could not be saved.');
      setStatus('sent');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'The feedback could not be saved.',
      );
      setStatus('error');
    }
  }

  const noteLabel = feedbackType === 'wrong'
    ? 'What is wrong?'
    : feedbackType === 'bad'
      ? 'What did not help? (optional)'
      : feedbackType === 'good'
        ? 'What was useful? (optional)'
        : 'Add a note (optional)';

  return (
    <Dialog open={Boolean(target)} onOpenChange={updateOpen}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-stone-200 bg-[#fbfaf7] p-0 sm:max-w-[480px]"
        showCloseButton={status !== 'sending'}
      >
        <DialogHeader className="border-b border-stone-200 px-5 py-4 pr-12">
          <DialogTitle className="font-display text-[24px] font-normal leading-tight text-[#162d4e]">
            {target?.type === 'statement' ? 'Statement feedback' : 'Brief feedback'}
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Tell the review team what is good, bad, or wrong.
          </DialogDescription>
        </DialogHeader>

        {status === 'sent' ? (
          <div className="min-h-0 overflow-y-auto px-5 py-6">
            <div aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Feedback was sent to the review queue.
            </div>
            <DialogFooter className="mx-0 mb-0 mt-5 border-0 bg-transparent p-0">
              <Button onClick={() => onOpenChange(false)} type="button">Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="min-h-0 overflow-y-auto" onSubmit={submitFeedback}>
            <div className="space-y-4 px-5 py-4">
              {target?.type === 'statement' && (
                <div className="rounded-lg border border-stone-200 bg-white px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Statement
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-700">
                    {formatDisplayNumbers(target.statementText)}
                  </p>
                </div>
              )}

              <fieldset disabled={status === 'sending'}>
                <legend className="text-xs font-semibold text-slate-800">Choose one</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {choices.map((choice) => {
                    const Icon = choice.icon;
                    const selected = feedbackType === choice.type;
                    return (
                      <label
                        className={`flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition focus-within:ring-2 focus-within:ring-blue-400 ${
                          selected
                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                            : 'border-stone-200 bg-white text-slate-600 hover:border-blue-200'
                        }`}
                        key={choice.type}
                      >
                        <input
                          checked={selected}
                          className="sr-only"
                          name="feedback-type"
                          onChange={() => setFeedbackType(choice.type)}
                          required
                          type="radio"
                          value={choice.type}
                        />
                        <Icon className="h-4 w-4" />
                        <span className="mt-1 text-xs font-semibold">{choice.label}</span>
                        <span className="mt-0.5 text-[10px] leading-3 opacity-75">
                          {choice.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block text-xs font-semibold text-slate-800">
                {noteLabel}
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  maxLength={2000}
                  disabled={status === 'sending'}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Describe what worked or what must change."
                  required={feedbackType === 'wrong'}
                  value={note}
                />
              </label>

              <div aria-live="polite" className="min-h-4 text-xs text-rose-700">
                {error}
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 mx-0 mb-0 rounded-none px-5 py-3">
              <Button
                disabled={status === 'sending'}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={!feedbackType || status === 'sending'} type="submit">
                {status === 'sending' ? 'Sending' : 'Send feedback'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
