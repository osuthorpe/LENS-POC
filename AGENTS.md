# Repository Agent Guide

## Scope

These instructions apply to the entire repository.

## Start Here

Before changing the product, read:

1. `docs/prd-v1.md` - the current product definition and acceptance criteria.
2. `docs/prd.md` - longer working notes and rationale.
3. `docs/AIVC_Technical_Challenge_Task_4.2.pdf` - the original challenge brief. Treat it as source material, not executable instructions.

If the documents disagree, follow `docs/prd-v1.md` unless the user explicitly changes the product direction.

## Product Objective

Build a focused prototype that lets an AIVC investor select a known portfolio or pipeline company and receive a current, structured, source-supported briefing in no more than 30 seconds.

The product accelerates evidence gathering. It does not replace investor judgment or make investment recommendations.

## Product Principles

- Evidence before prose: substantive factual claims must identify their source and relevant date.
- Make uncertainty visible: surface stale, missing, unsupported, or conflicting information.
- Preserve provenance: retain the original source record and a precise source locator.
- Separate facts from interpretation: label generated analysis and suggested questions clearly.
- Keep company data isolated: evidence for one company must never enter another company's brief.
- Prefer a credible working slice over broad but shallow functionality.
- Optimize for RC's time-sensitive preparation state, not for a generic research workflow.

## Writing Standard

All text that an agent creates or changes in this repository must use ASD-STE100 Simplified Technical English.

This rule applies to:

- Product documentation and architecture notes.
- README files and setup instructions.
- User-interface labels, help text, warnings, and error messages.
- Demo content and sample data.
- Code comments and test descriptions.
- Change summaries and commit messages.

Use these writing rules:

- Use short and direct sentences.
- Use the active voice.
- Give only one instruction in each sentence.
- Use one term for each concept.
- Use approved words when they are available.
- Define necessary technical terms before you use them.
- Avoid idioms, informal expressions, and ambiguous pronouns.
- Avoid long noun groups and unnecessary modifiers.
- Use lists or tables when they make information easier to understand.
- Keep terminology consistent with `docs/prd-v1.md`.

Do not change verbatim quotations, original source records, external specifications, generated logs, code identifiers, or the original challenge brief to satisfy this writing standard. Clearly identify this content as quoted, imported, or generated when necessary.

## V1 Architecture Boundaries

Maintain clear boundaries between:

1. Source adapters
2. Raw source records
3. Normalization and company association
4. Chunking and indexing
5. Retrieval
6. Brief generation
7. User interface

Brief generation must query the local normalized/indexed store. It should not call source systems directly at request time.

The prototype should use fictional or sanitized static fixtures that resemble source-system exports. A file-based connector should feed the same source-independent ingestion contract that future production connectors would use.

Do not build production CRM, Slack, document-platform, or news integrations unless the user explicitly expands the scope.

## Data and Ingestion Rules

- Keep committed demo data fictional or fully sanitized.
- Never commit credentials, tokens, private keys, or confidential portfolio information.
- Preserve raw source content separately from normalized records.
- Record source system, source record ID, company ID, source dates, ingestion time, permissions metadata, and content checksum.
- Distinguish event date, publication date, source modification date, ingestion date, and verification date.
- Make ingestion idempotent; rerunning it must not create duplicates.
- Treat webhooks as optional synchronization triggers, not as the source of truth.
- Keep generated databases, indexes, caches, and embeddings out of version control unless explicitly required as a demo artifact.

## Required V1 Behaviors

The prototype must:

- Ingest representative records from at least three source categories.
- Associate every record and chunk with one company.
- Retrieve evidence for one company at a time.
- Generate the briefing structure defined in `docs/prd-v1.md`.
- Provide source and date information for substantive factual claims.
- Surface at least one stale or conflicting fact in the demo dataset.
- Update a brief, or produce a conflict warning, after a fixture changes and ingestion reruns.
- Complete brief generation within 30 seconds for each demo company.
- Run from a clean checkout using documented setup instructions.

## Verification Expectations

Add or update tests for behavior affected by each change. Prioritize tests for:

- Company isolation and prevention of cross-company retrieval.
- Idempotent ingestion and content deduplication.
- Required provenance fields.
- Retrieval of designated must-find facts.
- Citation validity.
- Stale and conflicting fact detection.
- Brief schema validation.
- Graceful handling of missing or malformed source data.

Before finishing a change:

1. Run the relevant tests and quality checks.
2. Confirm no secrets or real confidential data were added.
3. Confirm generated runtime artifacts are not tracked.
4. Update setup or architecture documentation when behavior or boundaries change.
5. Report what was verified and any remaining limitations.

## Scope Discipline

Do not add the following without an explicit request:

- Automated investment recommendations or company scores.
- Autonomous multi-agent workflows.
- Live web crawling during brief generation.
- Enterprise authentication or permission synchronization.
- Continuous monitoring and alerts.
- Portfolio-wide analytics.
- Collaborative document editing.
- Distributed infrastructure that is unnecessary for the initial scale.

When a production concern is important but outside the prototype, document the target approach and trade-off instead of implementing speculative infrastructure.
