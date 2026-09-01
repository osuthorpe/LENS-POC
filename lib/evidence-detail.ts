import type {
  BriefItem,
  ClaimCitation,
  ClaimValue,
  ClaimValueKind,
  EvidenceState,
} from '@/lib/types';

const numericText = String.raw`\d+(?:,\d{3})*(?:\.\d+)?`;
const numberWord = String.raw`one|two|three|four|five|six|seven|eight|nine|ten`;
const numericOrWord = String.raw`(?:${numericText}|${numberWord})`;
const moneyMagnitude = String.raw`(?:[kmb]|thousand|million|billion)`;
const moneyAmount = String.raw`${numericText}(?:(?:\s*[kmb])|(?:\s+(?:thousand|million|billion)))?`;
const monthName = String.raw`January|February|March|April|May|June|July|August|September|October|November|December`;
const countNoun = String.raw`accounts?|contracts?|customers?|deals?|employees?|engineers?|expansions?|hires?|hospitals?|locations?|partners?|pilots?|positions?|products?|records?|roles?|sites?|sources?|teams?|trials?|users?|workloads?`;

const valuePatterns: Array<{ kind: ClaimValueKind; expression: RegExp }> = [
  {
    kind: 'money',
    expression: new RegExp(
      String.raw`(?:\bUSD\s+${moneyAmount}\b|\b${moneyAmount}\s+USD\b|\$${moneyAmount}\b)`,
      'gi',
    ),
  },
  {
    kind: 'percent',
    expression: new RegExp(
      String.raw`(?:\b${numericText}\s*%|\b${numericText}\s+percent\b)`,
      'gi',
    ),
  },
  {
    kind: 'duration',
    expression: new RegExp(
      String.raw`\b(?:approximately\s+)?${numericOrWord}(?:\s+|-)(?:days?|weeks?|months?|years?)\b`,
      'gi',
    ),
  },
  {
    kind: 'date',
    expression: new RegExp(
      String.raw`(?:\b(?:${monthName})\s+(?:\d{1,2}(?:st|nd|rd|th)?[,]?\s+)?\d{4}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:${monthName})\s+\d{4}\b|\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b)`,
      'gi',
    ),
  },
  {
    kind: 'count',
    expression: new RegExp(
      String.raw`\b${numericOrWord}\s+(?:[a-z-]+\s+){0,3}(?:${countNoun})\b`,
      'gi',
    ),
  },
];

const numberWords = new Map([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
]);

const monthNumbers = new Map([
  ['january', 1],
  ['february', 2],
  ['march', 3],
  ['april', 4],
  ['may', 5],
  ['june', 6],
  ['july', 7],
  ['august', 8],
  ['september', 9],
  ['october', 10],
  ['november', 11],
  ['december', 12],
]);

type ParsedValue =
  | { kind: 'money'; amount: number }
  | { kind: 'percent'; amount: number }
  | { kind: 'duration'; amount: number; unit: 'day' | 'month' }
  | { kind: 'date'; year: number; month: number | null; day: number | null }
  | { kind: 'count'; amount: number; noun: string };

function normalizeValue(value: string) {
  return value
    .toLowerCase()
    .replaceAll(',', '')
    .replace(/^approximately\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string) {
  const normalized = value.toLowerCase().replaceAll(',', '').trim();
  return numberWords.get(normalized) ?? Number(normalized);
}

function parseMoney(value: string): ParsedValue | null {
  const normalized = value
    .toLowerCase()
    .replaceAll(',', '')
    .replace('$', '')
    .replace(/\busd\b/g, '')
    .trim();
  const match = normalized.match(
    new RegExp(String.raw`^(\d+(?:\.\d+)?)\s*(${moneyMagnitude})?$`, 'i'),
  );
  if (!match?.[1]) return null;
  const magnitude = match[2]?.toLowerCase() ?? '';
  const multiplier = magnitude === 'k' || magnitude === 'thousand'
    ? 1_000
    : magnitude === 'm' || magnitude === 'million'
      ? 1_000_000
      : magnitude === 'b' || magnitude === 'billion'
        ? 1_000_000_000
        : 1;
  return { kind: 'money', amount: Number(match[1]) * multiplier };
}

function parsePercent(value: string): ParsedValue | null {
  const amount = Number(
    value.toLowerCase().replaceAll(',', '').replace('%', '').replace('percent', '').trim(),
  );
  return Number.isFinite(amount) ? { kind: 'percent', amount } : null;
}

function parseDuration(value: string): ParsedValue | null {
  const match = normalizeValue(value).replace(/(\w)-(?=[a-z])/i, '$1 ').match(
    new RegExp(String.raw`^(${numericOrWord})\s+(days?|weeks?|months?|years?)$`, 'i'),
  );
  if (!match?.[1] || !match[2]) return null;
  const amount = parseNumber(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2].toLowerCase();
  if (unit.startsWith('year')) {
    return { kind: 'duration', amount: amount * 12, unit: 'month' };
  }
  if (unit.startsWith('month')) {
    return { kind: 'duration', amount, unit: 'month' };
  }
  if (unit.startsWith('week')) {
    return { kind: 'duration', amount: amount * 7, unit: 'day' };
  }
  return { kind: 'duration', amount, unit: 'day' };
}

function parseDate(value: string): ParsedValue | null {
  const normalized = value.toLowerCase().replace(/(\d)(?:st|nd|rd|th)\b/g, '$1').trim();
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso?.[1] && iso[2] && iso[3]) {
    return {
      kind: 'date',
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
  }

  const monthFirst = normalized.match(/^([a-z]+)\s+(?:(\d{1,2}),?\s+)?(\d{4})$/);
  if (monthFirst?.[1] && monthFirst[3]) {
    const month = monthNumbers.get(monthFirst[1]);
    if (!month) return null;
    return {
      kind: 'date',
      year: Number(monthFirst[3]),
      month,
      day: monthFirst[2] ? Number(monthFirst[2]) : null,
    };
  }

  const dayFirst = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (!dayFirst?.[1] || !dayFirst[2] || !dayFirst[3]) return null;
  const month = monthNumbers.get(dayFirst[2]);
  if (!month) return null;
  return {
    kind: 'date',
    year: Number(dayFirst[3]),
    month,
    day: Number(dayFirst[1]),
  };
}

function countNounRoot(value: string) {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  return value.endsWith('s') ? value.slice(0, -1) : value;
}

function parseCount(value: string): ParsedValue | null {
  const normalized = normalizeValue(value);
  const match = normalized.match(new RegExp(String.raw`^(${numericOrWord})\s+(.+)$`, 'i'));
  if (!match?.[1] || !match[2]) return null;
  const amount = parseNumber(match[1]);
  const noun = match[2].split(/\s+/).at(-1);
  if (!Number.isFinite(amount) || !noun) return null;
  return { kind: 'count', amount, noun: countNounRoot(noun) };
}

function parseClaimValue(value: ClaimValue): ParsedValue | null {
  if (value.kind === 'money') return parseMoney(value.value);
  if (value.kind === 'percent') return parsePercent(value.value);
  if (value.kind === 'duration') return parseDuration(value.value);
  if (value.kind === 'date') return parseDate(value.value);
  return parseCount(value.value);
}

function parsedValueKey(value: ParsedValue) {
  if (value.kind === 'money' || value.kind === 'percent') {
    return `${value.kind}:${value.amount}`;
  }
  if (value.kind === 'duration') {
    return `${value.kind}:${value.amount}:${value.unit}`;
  }
  if (value.kind === 'date') {
    return `${value.kind}:${value.year}:${value.month ?? ''}:${value.day ?? ''}`;
  }
  return `${value.kind}:${value.amount}:${value.noun}`;
}

export function extractClaimValues(text: string): ClaimValue[] {
  const matches: Array<ClaimValue & { index: number }> = [];
  for (const pattern of valuePatterns) {
    for (const match of text.matchAll(pattern.expression)) {
      if (match[0] && match.index !== undefined) {
        matches.push({ kind: pattern.kind, value: match[0], index: match.index });
      }
    }
  }

  const seen = new Set<string>();
  return matches
    .sort((left, right) => left.index - right.index)
    .filter((match) => {
      const parsed = parseClaimValue(match);
      const key = parsed ? parsedValueKey(parsed) : `${match.kind}:${normalizeValue(match.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ kind, value }) => ({ kind, value }));
}

export function sourceSupportsValue(value: ClaimValue, sourceContent: string) {
  const claim = parseClaimValue(value);
  if (!claim) return false;
  const sourceValues = extractClaimValues(sourceContent)
    .map(parseClaimValue)
    .filter((item): item is ParsedValue => Boolean(item));

  return sourceValues.some((source) => {
    if (
      (claim.kind === 'money' || claim.kind === 'percent') &&
      source.kind === claim.kind
    ) {
      return Math.abs(source.amount - claim.amount) <= Math.max(0.001, Math.abs(claim.amount) * 1e-9);
    }
    if (claim.kind === 'duration' && source.kind === 'duration') {
      return source.amount === claim.amount && source.unit === claim.unit;
    }
    if (claim.kind === 'date' && source.kind === 'date') {
      if (source.year !== claim.year) return false;
      if (claim.month !== null && source.month !== claim.month) return false;
      if (claim.day !== null && source.day !== claim.day) return false;
      return true;
    }
    if (claim.kind === 'count' && source.kind === 'count') {
      return source.amount === claim.amount && source.noun === claim.noun;
    }
    return false;
  });
}

export function citationRoleForSource(
  kind: BriefItem['kind'],
  state: EvidenceState,
  values: ClaimValue[],
  sourceContent: string,
  verificationStatus: string | null,
): ClaimCitation['role'] {
  if (kind !== 'fact') return 'context';

  const sourceValues = values.filter((value) =>
    sourceSupportsValue(value, sourceContent),
  );
  const firstValue = values[0];
  const supportsFirstValue = Boolean(
    firstValue && sourceSupportsValue(firstValue, sourceContent),
  );

  if (state === 'conflict') {
    if (!sourceValues.length || sourceValues.length === values.length) return 'context';
    return supportsFirstValue ? 'supports' : 'conflicts';
  }

  const isEarlier = /superseded|old|earlier/i.test(verificationStatus ?? '') || (
    state === 'stale' &&
    Boolean(firstValue) &&
    !supportsFirstValue &&
    sourceValues.length > 0
  );
  return isEarlier ? 'earlier' : 'supports';
}

const ignoredWords = new Set([
  'after', 'also', 'and', 'because', 'before', 'company', 'does', 'from', 'have',
  'into', 'must', 'that', 'the', 'their', 'this', 'with', 'without',
]);

function claimTerms(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z0-9.]+/g)
        ?.filter((word) => (word.length > 2 || /\d/.test(word)) && !ignoredWords.has(word)) ?? [],
    ),
  );
}

export function relevantSourceExcerpt(sourceContent: string, statement: string) {
  const compact = sourceContent.replace(/\s+/g, ' ').trim();
  const sentences = compact
    .split(/(?<=[.!?])\s+(?=[A-Z0-9#])/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return compact;

  const terms = claimTerms(statement);
  const values = extractClaimValues(statement);
  const ranked = sentences.map((sentence, index) => {
    const normalizedSentence = normalizeValue(sentence);
    const termScore = terms.reduce(
      (score, term) => score + (normalizedSentence.includes(term) ? (/\d/.test(term) ? 3 : 1) : 0),
      0,
    );
    const valueScore = values.reduce(
      (score, value) => score + (sourceSupportsValue(value, sentence) ? 6 : 0),
      0,
    );
    return { index, score: termScore + valueScore, sentence };
  });

  const selected = ranked
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 2)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);

  return selected.join(' ');
}
