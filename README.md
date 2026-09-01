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

## Start From a Clean Checkout

You need these tools:

- Node.js 22.13 or later
- Docker Desktop with Docker Compose
- npm
- An OpenAI API key with access to the configured embedding and generation models

The local product uses port `3000`. PostgreSQL uses port `5438`.

### 1. Get the code

```bash
git clone https://github.com/osuthorpe/AVIC.git
cd AVIC
```

### 2. Add the environment file

```bash
cp .env.example .env.local
```

Open `.env.local`. Set `OPENAI_API_KEY` to your key. Data import and live brief generation require this key.

Keep the default `DATABASE_URL` for the local database. Change this value only if your database uses a different address.

Do not commit `.env.local`. Git ignores this file.

### 3. Install and prepare the product

Run these commands from the repository root:

```bash
npm ci
npm run setup
```

The setup command starts PostgreSQL. It creates the schema. It imports all 59 demo source records. It creates an embedding for each text chunk.

### 4. Start the product

```bash
npm run dev
```

Open `http://localhost:3000`.

If port `3000` is in use, the development server shows a different port. Use the URL that the terminal shows. Use the same port for the health check.

### 5. Check readiness

Keep the product running. Run this command in a second terminal:

```bash
curl -i http://localhost:3000/api/health
```

A ready product returns HTTP `200`. The response has `"status":"ready"`, `"companyCount":10`, and `"recordCount":59`. The `chunkCount` and `embeddingCount` values must be equal.

If the response returns HTTP `503`, check these items:

- Docker Desktop is running.
- `.env.local` contains `OPENAI_API_KEY`.
- Port `5438` is available.
- `npm run setup` completed without an error.

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

## Demo Test Data

All committed demo data is fictional. Do not use it as investment information.

The import reads these records:

| Source fixture | Record count | Purpose |
| --- | ---: | --- |
| `demo_data/raw/crm/companies.json` | 10 | Company profiles, aliases, stages, sectors, and relationship data |
| `demo_data/raw/crm/activities.json` | 14 | Revenue, runway, customer, risk, and diligence records |
| `demo_data/raw/meetings/*.md` | 5 | Detailed meeting evidence for the focus companies |
| `demo_data/raw/slack/messages.json` | 18 | Internal statements, confirmations, unresolved values, and missing items |
| `demo_data/raw/news/articles.json` | 12 | Fictional public product and company records |
| **Total** | **59** | All records that `npm run data:import` imports |

### Complete company fixture summary

The record columns show the count for CRM, meeting, Slack, and news records.

| Company | Company ID | Relationship | Records | Primary test data |
| --- | --- | --- | ---: | --- |
| VectorForge AI | `cmp_vectorforge` | Portfolio | 4 / 1 / 4 / 2 = 11 | Finance ARR is 3.4 million USD. CRM ARR is 3.8 million USD. The values are not reconciled. Monthly burn is 420000 USD. Runway is approximately 14 months. Northbank expands from one workload to four workloads. Contract value increases by 180000 USD. The Series B process is planned for January 2027. |
| LumenOps AI | `cmp_lumenops` | Portfolio | 4 / 1 / 3 / 2 = 10 | Runway decreases from 18 months in January to 9 months in August. Monthly recurring revenue is 142000 USD. Monthly burn is 310000 USD. The largest customer is 31 percent of monthly recurring revenue. The customer renews in November 2026. The company pauses three open roles. |
| Kestrel Health AI | `cmp_kestrelhealth` | Pipeline | 2 / 1 / 2 / 1 = 6 | The company has four paid research customers. ARR is 620000 USD. A Slack message claims that the company has an FDA pilot. No document or direct company statement confirms the claim. The company expects two more paid trials before the end of 2026. Regulatory and security documents are missing. |
| AtlasGrid AI | `cmp_atlasgrid` | Pipeline | 2 / 1 / 2 / 1 = 6 | `Atlas Grid` is an alias for `AtlasGrid AI`. ARR is 4.1 million USD. Gross retention is 92 percent. One automotive customer is 38 percent of revenue. Camera installation costs reduce first-year gross margin. |
| Cedar Robotics | `cmp_cedarrobotics` | Pipeline | 2 / 0 / 1 / 1 = 4 | The company has two paid warehouse trials. Revenue, burn, runway, gross margin, deployment cost, and trial conversion data are missing. |
| Prism Legal AI | `cmp_prismlegal` | Pipeline | 2 / 0 / 1 / 1 = 4 | ARR is 1.1 million USD. Net revenue retention is 118 percent. The SOC 2 Type I audit is complete. The Type II audit is expected in the first quarter of 2027. |
| SageBio Systems | `cmp_sagebio` | Pipeline | 2 / 0 / 1 / 1 = 4 | The company has three design partners and no paid revenue. The founders plan to raise 2 million USD. Data access rights are not clear. |
| QuantaLedger | `cmp_quantaledger` | Pipeline | 2 / 1 / 2 / 1 = 6 | ARR is 780000 USD. The company has 11 customers. Two customers are 46 percent of revenue. Two reference calls are positive. Gross margin and renewal dates are missing. |
| RelayWorks AI | `cmp_relayworks` | Pipeline | 2 / 0 / 1 / 1 = 4 | The company has six paid customers. ARR is 360000 USD. The sales cycle is 90 days. A new customer has 85 field technicians. Implementation time and weekly use data are missing. |
| Northstar Security AI | `cmp_northstarsecurity` | Pipeline | 2 / 0 / 1 / 1 = 4 | The company opens a private beta. Revenue, customer, burn, runway, and team data are missing. |

### Required company acceptance conditions

`demo_data/manifest.json` defines these five conditions. The V1 verification also checks the required retrieval and brief behavior.

| Condition | Required source records | Expected result |
| --- | --- | --- |
| VectorForge ARR conflict | `meeting-001`, `crm-activity-002`, `slack-001` | Retrieval includes `meeting-001`. The brief shows the unresolved 3.4 million USD Finance value and 3.8 million USD CRM value. The values use separate direct source quotes. |
| LumenOps runway change | `crm-activity-004`, `crm-activity-005`, `meeting-002`, `slack-004` | The brief uses 9 months as the current runway. It keeps 18 months as an earlier value. It does not mark the current value as old. |
| Kestrel unverified claim | `slack-006`, `slack-007`, `meeting-003`, `news-005` | Retrieval includes `slack-006`. The brief shows the FDA pilot statement as unverified. It does not state the claim as a fact. |
| AtlasGrid alias | `crm-company-004`, `meeting-004`, `slack-008`, `news-006` | The import associates `Atlas Grid` records with `cmp_atlasgrid` and displays `AtlasGrid AI`. |
| Northstar missing metrics | `crm-activity-014`, `slack-016`, `news-012` | The brief shows that revenue, customer, burn, runway, and team data are missing. |

Keep these company IDs, source record IDs, values, dates, and verification states stable. If you change one of them, update `demo_data/manifest.json` and the related tests in the same change.

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
| `demo_data/manifest.json` | Dataset counts and required company acceptance conditions |
| `demo_data/README.md` | Demo data purpose, conditions, and file layout |
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
