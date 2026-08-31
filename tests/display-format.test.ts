import { describe, expect, it } from 'vitest';
import { formatDisplayNumbers } from '@/lib/display-format';

describe('display number format', () => {
  it('adds separators to large whole numbers', () => {
    expect(formatDisplayNumbers(
      'Contract value increased by 180000 USD. Monthly burn is 420000 USD.',
    )).toBe(
      'Contract value increased by 180,000 USD. Monthly burn is 420,000 USD.',
    );
  });

  it('keeps years and formatted values unchanged', () => {
    expect(formatDisplayNumbers(
      'The 2027 plan includes 180,000 USD.',
    )).toBe('The 2027 plan includes 180,000 USD.');
  });
});
