import { describe, expect, it } from 'vitest';
import { selectKeyFacts } from '@/lib/brief-view';
import type { BriefItem } from '@/lib/types';

function briefItem(
  id: string,
  text: string,
  kind: BriefItem['kind'] = 'fact',
): BriefItem {
  return {
    id,
    text,
    sourceIds: [`source-${id}`],
    sourceDate: '2026-08-20T12:00:00Z',
    kind,
    state: 'confirmed',
  };
}

describe('brief view', () => {
  it('puts material changes and current facts in one list', () => {
    const changes = [
      briefItem('change-1', 'The company paused three open roles.'),
      briefItem('change-analysis', 'Hiring can increase burn.', 'analysis'),
    ];
    const currentState = [
      briefItem('current-1', 'Monthly burn is 650000 USD.'),
      briefItem('current-duplicate', 'The company paused three open roles.'),
    ];

    expect(selectKeyFacts(changes, currentState).map((item) => item.text)).toEqual([
      'The company paused three open roles.',
      'Monthly burn is 650000 USD.',
    ]);
  });

  it('removes two facts that use the same values and evidence', () => {
    const change = briefItem(
      'change-runway',
      'Runway decreased from 18 months to 9 months.',
    );
    change.sourceIds = ['meeting-cash-review', 'crm-runway'];
    change.values = [
      { kind: 'duration', value: '18 months' },
      { kind: 'duration', value: '9 months' },
    ];

    const current = briefItem(
      'current-runway',
      'The newest runway is 9 months. The earlier runway was 18 months.',
    );
    current.sourceIds = ['meeting-cash-review'];
    current.values = [
      { kind: 'duration', value: '9 months' },
      { kind: 'duration', value: '18 months' },
    ];

    expect(selectKeyFacts([change], [current])).toEqual([change]);
  });
});
