export type RelationshipStatus = 'portfolio' | 'pipeline';
export type EvidenceState =
  | 'confirmed'
  | 'conflict'
  | 'stale'
  | 'missing'
  | 'unverified';

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

export interface BriefItem {
  id: string;
  text: string;
  sourceIds: string[];
  sourceDate: string | null;
  state: EvidenceState;
  kind: 'fact' | 'analysis' | 'question';
}

export interface BriefResult {
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
