import type {
  BriefItem,
  ClaimCitation,
  ClaimValue,
  ClaimValueKind,
  EvidenceState,
} from '@/lib/types';

const valuePatterns: Array<{ kind: ClaimValueKind; expression: RegExp }> = [
  {
    kind: 'money',
    expression: /\b\d[\d,]*(?:\.\d+)?(?:\s+(?:million|billion|thousand))?\s+USD\b/gi,
  },
  {
    kind: 'percent',
    expression: /\b\d+(?:\.\d+)?\s+percent\b/gi,
  },
  {
    kind: 'duration',
    expression: /\b(?:approximately\s+)?\d+(?:\.\d+)?\s+months?\b/gi,
  },
  {
    kind: 'date',
    expression: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
  },
  {
    kind: 'count',
    expression: /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:[a-z-]+\s+){0,2}(?:customers?|workloads?|roles?|trials?|expansions?|records?|sources?|users?|contracts?|teams?)\b/gi,
  },
];

function normalizeValue(value: string) {
  return value
    .toLowerCase()
    .replaceAll(',', '')
    .replace(/^approximately\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
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
      const key = `${match.kind}:${normalizeValue(match.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ kind, value }) => ({ kind, value }));
}

export function sourceSupportsValue(value: ClaimValue, sourceContent: string) {
  return normalizeValue(sourceContent).includes(normalizeValue(value.value));
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

  const isEarlier = /superseded|old/i.test(verificationStatus ?? '') || (
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
