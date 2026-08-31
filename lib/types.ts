export type RelationshipStatus = 'portfolio' | 'pipeline';
export type EvidenceState =
  | 'confirmed'
  | 'conflict'
  | 'stale'
  | 'missing'
  | 'unverified';

export type ClaimValueKind = 'money' | 'percent' | 'duration' | 'date' | 'count';

export interface ClaimValue {
  kind: ClaimValueKind;
  value: string;
}

export interface ClaimCitation {
  sourceId: string;
  role: 'supports' | 'conflicts' | 'earlier' | 'context';
  excerpt: string;
  values: ClaimValue[];
}

export interface Company {
  id: string;
  name: string;
  aliases: string[];
  relationshipStatus: RelationshipStatus;
  pipelineStage: string | null;
  companyStage: string;
  sector: string;
  description: string;
  owner: string;
  lastReviewDate: string | null;
  updatedAt: string;
  sourceCount: number;
  latestSourceDate: string | null;
  sourceCategories: string[];
}

export interface SourceReference {
  id: string;
  sourceType: 'crm' | 'meeting' | 'slack' | 'news';
  title: string;
  sourceDate: string;
  locator: string;
  content: string;
  verificationStatus: string | null;
}

export interface SourceDetail extends SourceReference {
  companyId: string;
  eventDate: string | null;
  publicationDate: string | null;
  modifiedDate: string | null;
  ingestedAt: string;
  verifiedAt: string | null;
  accessMetadata: Record<string, unknown>;
  sourceQuality: number;
  normalizedContent: string;
  rawContent: Record<string, unknown>;
  facts: SourceFact[];
}

export interface SourceFact {
  key: string;
  value: string;
  date: string | null;
  verificationStatus: string | null;
}

export interface BriefItem {
  id: string;
  text: string;
  sourceIds: string[];
  sourceDate: string | null;
  state: EvidenceState;
  kind: 'fact' | 'analysis' | 'question';
  values?: ClaimValue[];
  citations?: ClaimCitation[];
}

export type FeedbackType = 'good' | 'bad' | 'wrong';
export type FeedbackSection = 'key_facts' | 'risks' | 'questions';

export type FeedbackTarget =
  | {
      type: 'brief';
    }
  | {
      type: 'statement';
      statementId: string;
      statementText: string;
      section: FeedbackSection;
      itemKind: BriefItem['kind'];
      sourceIds: string[];
    };

export interface BriefResult {
  briefRunId?: string;
  company: Company;
  generatedAt: string;
  durationMs: number;
  mode: 'evidence-engine' | 'evidence-fallback';
  inputQuery: string;
  currentState: BriefItem[];
  changes: BriefItem[];
  risks: BriefItem[];
  openQuestions: BriefItem[];
  suggestedQuestions: BriefItem[];
  sources: SourceReference[];
  coverage: Array<{
    category: string;
    count: number;
    latestDate: string | null;
  }>;
}
