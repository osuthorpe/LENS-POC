import { describe, expect, it } from 'vitest';
import {
  extractClaimValues,
  relevantSourceExcerpt,
  sourceSupportsValue,
} from '@/lib/evidence-detail';

describe('evidence detail', () => {
  it('extracts money and duration values in statement order', () => {
    const values = extractClaimValues(
      'Annual recurring revenue is 3.4 million USD. Monthly burn is 420000 USD. Runway is approximately 14 months.',
    );
    expect(values.map((value) => value.value)).toEqual([
      '3.4 million USD',
      '420000 USD',
      'approximately 14 months',
    ]);
  });

  it('extracts count and date values', () => {
    const values = extractClaimValues(
      'The company opened four infrastructure engineering roles before January 2027.',
    );
    expect(values.map((value) => value.value)).toEqual([
      'four infrastructure engineering roles',
      'January 2027',
    ]);
  });

  it('finds a statement value in a source record', () => {
    const [value] = extractClaimValues('Contract value increased by 180000 USD.');
    expect(value).toBeDefined();
    expect(sourceSupportsValue(value!, 'The contract value increased by 180000 USD.')).toBe(true);
    expect(sourceSupportsValue(value!, 'The contract value did not change.')).toBe(false);
  });

  it('selects the source sentences that support a statement', () => {
    const excerpt = relevantSourceExcerpt(
      'The team reviewed the account. Northbank expanded from one workload to four workloads. The contract value increased by 180000 USD. The team will meet next week.',
      'Northbank expanded to four workloads. Contract value increased by 180000 USD.',
    );
    expect(excerpt).toContain('four workloads');
    expect(excerpt).toContain('180000 USD');
    expect(excerpt).not.toContain('meet next week');
  });
});
