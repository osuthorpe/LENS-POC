import { describe, expect, it } from 'vitest';
import {
  citationRoleForSource,
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

  it('extracts a money value that has a thousands separator', () => {
    const values = extractClaimValues('Contract value increased by 180,000 USD.');
    expect(values.map((value) => value.value)).toEqual(['180,000 USD']);
  });

  it('extracts a money value when USD is before the value', () => {
    const values = extractClaimValues('Annual recurring revenue is USD 620,000.');
    expect(values.map((value) => value.value)).toEqual(['USD 620,000']);
    expect(sourceSupportsValue(values[0]!, 'Annual recurring revenue is 620000 USD.')).toBe(true);
  });

  it('normalizes short money and percentage formats', () => {
    const values = extractClaimValues(
      'Annual recurring revenue is 920k USD. Gross retention is 97%.',
    );

    expect(values.map((value) => value.value)).toEqual(['920k USD', '97%']);
    expect(sourceSupportsValue(
      values[0]!,
      'Annual recurring revenue is 920,000 USD.',
    )).toBe(true);
    expect(sourceSupportsValue(
      values[1]!,
      'Gross retention is 97 percent.',
    )).toBe(true);
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

  it('does not use a partial numeric match', () => {
    const [duration] = extractClaimValues('Runway is 9 months.');
    const [money] = extractClaimValues('Monthly burn is 420,000 USD.');

    expect(sourceSupportsValue(duration!, 'Reported runway is 19 months.')).toBe(false);
    expect(sourceSupportsValue(
      money!,
      'The company has 420000 users. Cash is 1 USD.',
    )).toBe(false);
  });

  it('normalizes durations, dates, and counts', () => {
    const [duration] = extractClaimValues('Runway is one year.');
    const [planDuration] = extractClaimValues('The company uses a 13-week cash plan.');
    const [date] = extractClaimValues('The launch is in August 2026.');
    const [count] = extractClaimValues('The company opened four engineering roles.');

    expect(sourceSupportsValue(duration!, 'Reported runway is 12 months.')).toBe(true);
    expect(sourceSupportsValue(planDuration!, 'The cash plan covers 13 weeks.')).toBe(true);
    expect(sourceSupportsValue(date!, 'The launch date is August 24, 2026.')).toBe(true);
    expect(sourceSupportsValue(count!, 'The company opened 4 security roles.')).toBe(true);
  });

  it('supports a count when the source uses a more specific noun phrase', () => {
    const [value] = extractClaimValues('The customer base has four paid customers.');
    expect(value).toBeDefined();
    expect(sourceSupportsValue(value!, 'The company has four paid research customers.')).toBe(true);
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

  it('identifies the source that has a conflicting value', () => {
    const values = extractClaimValues(
      'Finance reports 3.4 million USD. CRM reports 3.8 million USD.',
    );

    expect(citationRoleForSource(
      'fact',
      'conflict',
      values,
      'CRM reports recognized annual recurring revenue of 3.8 million USD.',
      'metric review',
    )).toBe('conflicts');
  });

  it('identifies an earlier value without marking the current fact as old', () => {
    const values = extractClaimValues(
      'Runway decreased from 18 months in January to 9 months in August.',
    );

    expect(citationRoleForSource(
      'fact',
      'confirmed',
      values,
      'The company reported 18 months of runway in January.',
      'earlier value',
    )).toBe('earlier');
  });
});
