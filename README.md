# LENS

LENS prepares a current company brief from approved source records. It shows the source and date for each important fact. It also shows old, missing, conflicting, and unverified information.

V1 uses fictional demo records. It does not connect to production source systems.

## What V1 Includes

- 10 curated companies
- 2 portfolio companies
- 8 pipeline companies
- 59 source records
- CRM, meeting, Slack, and news source types
- PostgreSQL as the source of truth
- pgvector for exact embedding search
- PostgreSQL full-text search
- `gpt-5.6-sol` for source-supported brief generation
- The OpenAI Responses API with a strict output schema
- A deterministic local fallback for model or validation failures
- Company-level evidence isolation
- Source context for each brief item
- A recorded evidence set for each brief run
- `Good`, `Bad`, and `Wrong` feedback for each statement and full brief
- A company-scoped feedback review queue
- A Shadcn user interface

## Start the Product

You need these tools:

- Node.js 22.13 or later
- Docker Desktop
- npm
- An OpenAI API key

Copy the environment example before the first setup:

```bash
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`. Data import and live brief generation require this key.

Keep the default `DATABASE_URL` for the local database. Change this value only if your database uses a different address.

Do not commit `.env.local`. Git ignores this file.

Run these commands from the repository root:

```bash
npm install
npm run setup
npm run dev
```

Open `http://localhost:3000`.

The setup command starts PostgreSQL. It creates the schema. It then imports the demo data and creates embeddings.

## Import the Demo Data Again

Run this command:

```bash
npm run data:import
```

The import uses a content checksum. A second import does not create duplicate records. It does not request embeddings for unchanged chunks. A changed fixture updates its record, chunks, facts, and embeddings.

## Verify V1

Run these checks:

```bash
npm test
npm run lint
npm run build
npm run verify:embeddings
npm run verify:generation
npm run verify:v1
```

The V1 verification checks these items:

- All 10 companies get a brief.
- Each brief is ready in less than 30 seconds.
- Each brief uses evidence for one company only.
- Each brief item has valid citations.
- All 59 chunks have current OpenAI embeddings.
- Two live briefs use `gpt-5.6-sol` and the `openai-grounded` mode.
- A failed or invalid model result uses the `evidence-fallback` mode.
- Both modes keep valid citations and company isolation.
- VectorForge shows the revenue conflict.
- LumenOps uses the current runway value and keeps the earlier value in Evidence.
- The feedback queue links each item to one saved brief and company.
- Kestrel Health shows the unverified FDA claim.
- Northstar Security shows the missing metrics.

## Data Flow

The import process reads files from `demo_data/raw`. It keeps the original record in PostgreSQL. It also creates standard text, facts, chunks, and checksums. It sends each fictional text chunk to the OpenAI Embeddings API. The API uses `text-embedding-3-large`. It returns a 1,536-value embedding. PostgreSQL stores the embedding.

The retrieval service sends the fixed query text to the OpenAI Embeddings API. It uses the returned embedding to search the stored embeddings. The database applies a hard company filter before it ranks evidence. The rank combines full-text rank, embedding similarity, source quality, and source date.

After retrieval, the brief service sends selected company data and retrieved evidence to `gpt-5.6-sol` through the OpenAI Responses API. The request uses low reasoning effort, a strict JSON schema, no tools, `store: false`, a 27-second model timeout, and no automatic retry. The full brief request has a 29-second budget. It sends only the source ID, source type, title, date, verification status, and standard text for each retrieved record.

The model returns statement text, evidence state, retrieved source IDs, and exact evidence quotes. The server confirms that each quote occurs in its source. It checks that each factual statement uses content words from its quotes. It also checks money, percentages, durations, dates, and counts against the cited sources. A value conflict must use two direct sources for the different values. The server rejects investment recommendations. It then creates item IDs, dates, values, excerpts, and citation roles. It also makes sure that each source marked `unverified` appears as an unverified risk. The audit record shows how many required signals the server added.

A model error, timeout, refusal, incomplete result, invalid schema, invalid quote, unsupported statement, unsupported value, or missing required signal starts the deterministic local fallback. A successful source-supported result uses the `openai-grounded` mode. A fallback result uses the `evidence-fallback` mode. The brief run stores the model, prompt version, token use, model time, safe fallback reason, and exact evidence set.

The service shows `Update needed` only when every available source for a fact is marked as old. A current source removes this warning.

The interface loads the latest saved brief when it opens and when the user selects a company. If a company has no saved brief yet, it prepares the first one. The Refresh brief button explicitly prepares and saves a new brief. The interface can send feedback for one statement or the full brief. The server checks the saved brief and company. It copies the saved statement and source IDs into the review item. The browser cannot set the priority or status.

V1 sends fictional chunk text, query text, selected company data, and retrieved evidence text to OpenAI. The Embeddings API creates search embeddings. The Responses API creates the source-supported brief. V1 does not send raw JSON records, access data, or records for another company.

See [the architecture document](docs/architecture.md) for more information.

## Main Commands

| Command | Result |
| --- | --- |
| `npm run dev` | Start the local product. |
| `npm run setup` | Start the database, create the schema, and import the demo data. |
| `npm run db:up` | Start PostgreSQL and pgvector. |
| `npm run db:down` | Stop PostgreSQL. |
| `npm run db:migrate` | Create or update the database schema. |
| `npm run data:import` | Import the demo source files. |
| `npm test` | Run the unit tests. |
| `npm run verify:embeddings` | Check one live semantic embedding request. |
| `npm run verify:generation` | Check two live source-supported briefs. |
| `npm run verify:v1` | Check the V1 acceptance conditions against the database. |

## Important Files

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Main company brief interface |
| `app/api` | Company, brief, source, feedback, import, and health endpoints |
| `lib/embeddings.ts` | OpenAI embedding requests and validation |
| `lib/ingestion.ts` | File adapters, normalization, checksums, chunks, facts, and embeddings |
| `lib/retrieval.ts` | Company-filtered hybrid retrieval |
| `lib/brief-generation.ts` | Source-supported generation, output checks, and fallback control |
| `lib/brief.ts` | Evidence-based brief generation and citation checks |
| `db/schema.sql` | PostgreSQL and pgvector schema |
| `demo_data/raw` | Fictional source exports |
| `docs/prd-v1.md` | V1 product requirements |

## V1 Limits

- V1 uses static source files.
- V1 uses OpenAI for embeddings and source-supported brief generation.
- V1 uses fictional static source files instead of production connectors.
- V1 does not make investment recommendations.
- V1 does not enforce production access rules.
- V1 does not include a reviewer interface or reviewer identity.
- V1 does not run scheduled imports or webhooks.
- V1 does not use an approximate vector index. Exact search is sufficient for this data size.
