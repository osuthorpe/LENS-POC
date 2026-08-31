# AIVC Company Intelligence

AIVC Company Intelligence prepares a current company brief from approved source records. It shows the source and date for each important fact. It also shows old, missing, conflicting, and unverified information.

V1 uses fictional demo records. It does not connect to production source systems.

## What V1 Includes

- 10 curated companies
- 2 portfolio companies
- 8 pipeline companies
- 59 source records
- CRM, meeting, Slack, and news source types
- PostgreSQL as the source of truth
- pgvector for local vector search
- PostgreSQL full-text search
- Company-level evidence isolation
- Source context for each brief item
- A recorded evidence set for each brief run
- A Shadcn user interface

## Start the Product

You need these tools:

- Node.js 22.13 or later
- Docker Desktop
- npm

Run these commands from the repository root:

```bash
npm install
npm run setup
npm run dev
```

Open `http://localhost:3000`.

The setup command starts PostgreSQL. It creates the schema. It then imports the demo data.

## Use a Different Database Address

Copy the environment example if your database does not use the default address:

```bash
cp .env.example .env.local
```

Then change `DATABASE_URL` in `.env.local`.

Do not commit `.env.local`. Git ignores this file.

## Import the Demo Data Again

Run this command:

```bash
npm run data:import
```

The import uses a content checksum. A second import does not create duplicate records. A changed fixture updates its record, chunks, facts, and vectors.

## Verify V1

Run these checks:

```bash
npm test
npm run lint
npm run build
npm run verify:v1
```

The V1 verification checks these items:

- All 10 companies get a brief.
- Each brief is ready in less than 30 seconds.
- Each brief uses evidence for one company only.
- Each brief item has valid citations.
- All 59 chunks have vectors.
- VectorForge shows the revenue conflict.
- LumenOps shows the old runway value.
- Kestrel Health shows the unverified FDA claim.
- Northstar Security shows the missing metrics.

## Data Flow

The import process reads files from `demo_data/raw`. It keeps the original record in PostgreSQL. It also creates standard text, facts, chunks, checksums, and local vectors.

The brief request applies a hard company filter first. It then combines full-text rank, vector similarity, source quality, and source date. The brief engine uses only the returned evidence. It records the retrieval input, evidence rank, result, and generation time.

V1 creates vectors on the local computer. V1 does not send source records to an external model. The local OpenAI key stays unused until the team approves the source data that a model can receive.

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
| `npm run verify:v1` | Check the V1 acceptance conditions against the database. |

## Important Files

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Main company brief interface |
| `app/api` | Company, brief, source, import, and health endpoints |
| `lib/ingestion.ts` | File adapters, normalization, checksums, chunks, facts, and vectors |
| `lib/retrieval.ts` | Company-filtered hybrid retrieval |
| `lib/brief.ts` | Evidence-based brief generation and citation checks |
| `db/schema.sql` | PostgreSQL and pgvector schema |
| `demo_data/raw` | Fictional source exports |
| `docs/prd-v1.md` | V1 product requirements |

## V1 Limits

- V1 uses static source files.
- V1 uses a local evidence engine for brief generation.
- V1 does not make investment recommendations.
- V1 does not enforce production access rules.
- V1 does not run scheduled imports or webhooks.
- V1 does not use an approximate vector index. Exact search is sufficient for this data size.
