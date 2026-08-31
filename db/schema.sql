CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  domain TEXT,
  relationship_status TEXT NOT NULL CHECK (relationship_status IN ('portfolio', 'pipeline')),
  pipeline_stage TEXT,
  company_stage TEXT NOT NULL,
  sector TEXT NOT NULL,
  description TEXT NOT NULL,
  relationship_owner TEXT NOT NULL,
  investment_date DATE,
  investment_amount_usd NUMERIC,
  ownership_percent NUMERIC,
  last_review_date TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_records (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('crm', 'meeting', 'slack', 'news')),
  title TEXT NOT NULL,
  source_locator TEXT NOT NULL,
  event_date TIMESTAMPTZ,
  publication_date TIMESTAMPTZ,
  source_modified_date TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  access_metadata JSONB NOT NULL DEFAULT '{"scope":"demo"}'::jsonb,
  verification_status TEXT,
  source_quality REAL NOT NULL DEFAULT 0.7,
  raw_content JSONB NOT NULL,
  normalized_content TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding VECTOR(1536),
  search_document TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_record_id, position)
);

CREATE TABLE IF NOT EXISTS facts (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  fact_key TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  fact_date TIMESTAMPTZ,
  verification_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brief_runs (
  id UUID PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  retrieval_input TEXT NOT NULL,
  generation_mode TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL,
  result JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS brief_evidence (
  brief_run_id UUID NOT NULL REFERENCES brief_runs(id) ON DELETE CASCADE,
  source_record_id TEXT NOT NULL REFERENCES source_records(id) ON DELETE RESTRICT,
  rank_position INTEGER NOT NULL,
  score REAL NOT NULL,
  PRIMARY KEY (brief_run_id, source_record_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS brief_runs_id_company_unique_idx
  ON brief_runs (id, company_id);

CREATE TABLE IF NOT EXISTS brief_feedback (
  id UUID PRIMARY KEY,
  brief_run_id UUID NOT NULL,
  company_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('brief', 'statement')),
  statement_id TEXT,
  statement_text TEXT,
  statement_section TEXT CHECK (
    statement_section IS NULL OR statement_section IN ('key_facts', 'risks', 'questions')
  ),
  statement_kind TEXT CHECK (
    statement_kind IS NULL OR statement_kind IN ('fact', 'analysis', 'question')
  ),
  source_record_ids TEXT[] NOT NULL DEFAULT '{}',
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('good', 'bad', 'wrong')),
  feedback_note TEXT CHECK (
    feedback_note IS NULL OR char_length(feedback_note) <= 2000
  ),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'in_review', 'resolved', 'dismissed')
  ),
  submitted_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT brief_feedback_run_company_fk
    FOREIGN KEY (brief_run_id, company_id)
    REFERENCES brief_runs (id, company_id)
    ON DELETE RESTRICT,
  CONSTRAINT brief_feedback_target_check
    CHECK (
      (
        target_type = 'brief'
        AND statement_id IS NULL
        AND statement_text IS NULL
        AND statement_section IS NULL
        AND statement_kind IS NULL
      )
      OR
      (
        target_type = 'statement'
        AND statement_id IS NOT NULL
        AND statement_text IS NOT NULL
        AND statement_section IS NOT NULL
        AND statement_kind IS NOT NULL
      )
    ),
  CONSTRAINT brief_feedback_wrong_note_check
    CHECK (
      feedback_type <> 'wrong'
      OR NULLIF(BTRIM(feedback_note), '') IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS brief_feedback_triage_idx
  ON brief_feedback (company_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS brief_feedback_target_idx
  ON brief_feedback (brief_run_id, statement_id);

CREATE INDEX IF NOT EXISTS source_records_company_date_idx
  ON source_records (company_id, event_date DESC NULLS LAST, publication_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS source_records_company_type_idx
  ON source_records (company_id, source_type);
CREATE INDEX IF NOT EXISTS chunks_company_idx ON document_chunks (company_id);
CREATE INDEX IF NOT EXISTS chunks_search_idx ON document_chunks USING GIN (search_document);
CREATE INDEX IF NOT EXISTS facts_company_key_idx ON facts (company_id, fact_key, fact_date DESC);

COMMENT ON COLUMN document_chunks.embedding IS
  'An OpenAI text-embedding-3-small vector. V1 uses exact vector search.';
