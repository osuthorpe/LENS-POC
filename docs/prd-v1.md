# Portfolio Intelligence Brief - PRD V1

- **Status:** Working V1
- **Primary user:** RC, a principal at AIVC
- **Objective:** Give RC a current company brief in 30 seconds or less. Support each important fact with a source.

## Insight

AIVC investors have enough company information. They cannot collect and check the information quickly.

An investor must search customer relationship management (CRM) records, meeting notes, Slack messages, public filings, and news. The investor must find new facts and compare conflicting facts. This work takes approximately 90 minutes for one company.

An artificial intelligence (AI) summary is not sufficient. The user must know the source and date of each important fact. The product must also show uncertainty.

The best brief contains only useful information. It shows current facts, important changes, risks, and open questions. The user can check and use each item.

## Job to Be Done

When I prepare for a company discussion, help me find the current facts from all approved sources. Then I can use my time for judgment, not for search and comparison.

## User Profile: RC Before a Company Discussion

RC is a principal at AIVC. He monitors approximately 50 portfolio companies and 200 pipeline companies.

RC uses the product before a meeting, a review, or an unexpected request. He knows the company, but his information can be old. New information is in different systems. RC does not know which source has the newest fact.

RC has little time. He needs to know what is true now. He also needs to know what changed and what is missing. He must see sources that do not agree. He must prepare the next questions.

| Starting state | Required state |
| --- | --- |
| RC knows the company, but his information is old. | RC understands the current state of the company. |
| The information is in different systems. | The product shows the important evidence in one place. |
| RC does not know which facts are current. | The product shows dates and conflicts. |
| RC thinks that information can be missing. | The product shows the known gaps. |
| RC spends time on search and copy tasks. | RC spends time on review and judgment. |
| RC does not know which questions to ask. | RC has focused questions for the next discussion. |

The product succeeds when RC can prepare without a full manual search.

## V1 Experience

RC selects a known company. RC requests the newest brief. The product returns the brief in 30 seconds or less.

The brief contains these sections:

1. **Company snapshot:** The company description, stage, sector, status, and investment relationship.
2. **Current state:** The available financial, operating, customer, product, team, and funding information.
3. **Changes:** Important changes since the last review or discussion.
4. **Risks:** Negative signals, dependencies, conflicts, and open concerns.
5. **Open questions:** Information that is missing, old, or unclear.
6. **Suggested questions:** Questions that RC can ask in the next discussion.
7. **Sources and coverage:** Source dates, source references, and known gaps.

The product must identify generated analysis. The product must separate this analysis from source facts. The product prepares evidence for a decision. The product does not make the decision.

## User Stories and Acceptance Criteria

| User story | Acceptance criterion |
| --- | --- |
| RC selects a company and requests a brief. | The product returns a useful brief in 30 seconds or less. |
| RC wants to know what changed. | The brief shows dated changes since the last important review. |
| RC wants to check an important fact. | The fact shows its source and date. RC can open the source context. |
| RC wants to know the quality of the information. | The brief shows old, missing, unsupported, and conflicting information. |
| RC wants to prepare for a discussion. | The brief gives questions that come from evidence or known gaps. |
| The team wants to keep company data separate. | A company brief contains data for that company only. |

## Data Import and Integration

In this document, **data import** means the transfer of source records into the product. A **source adapter** reads records from one source format. It sends the records to the common import process.

V1 uses fictional or sanitized files that represent source exports:

- CRM records in JavaScript Object Notation (JSON) or comma-separated values (CSV) format
- Meeting notes in Markdown text format
- Slack messages in JSON format
- Public news or company announcements in JSON format

### Demo data size

V1 uses 10 curated companies. The dataset contains 2 portfolio companies and 8 pipeline companies. This ratio represents the target company set.

The main demo does not need all 250 companies. A separate generated dataset can test load and response time later. Generated data must not replace the curated data.

A content checksum is a calculated value that identifies record content.

The import process does these tasks:

1. The source adapter reads a source record.
2. The product keeps the original record.
3. The product assigns a source identifier.
4. The product assigns a company identifier.
5. The product records the source dates.
6. The product records the access information.
7. The product calculates a content checksum.
8. The product does not make a duplicate record.
9. The product divides long text into small search units.
10. The product writes the result to a local search store.

The product uses the local search store when RC requests a brief. The product does not call the source systems at this time. This design supports the 30-second limit. It also gives repeatable results.

A production connector can replace each file adapter. The connector can get only records that changed after the last import. A webhook is a message that reports a source change. A webhook can start an import. A scheduled comparison must also find missed changes and deleted records.

V1 does not include production authentication. It does not include scheduled imports or webhook processing. It does not include automatic company matching. It does not enforce source access rules. The target architecture must show these production functions.

## Functional Requirements

V1 must:

- Import records from at least three source categories.
- Keep the original source content.
- Keep the source reference for each record.
- Convert each source record to the common document format.
- Assign each record and search unit to one company.
- Prevent duplicate records after a repeated import.
- Retrieve data for one company at a time.
- Rank evidence by company, date, and source quality.
- Produce the specified brief sections.
- Show conflicts without an automatic resolution.
- Record the retrieval input.
- Record the evidence that the system used.
- Record the generation time.
- Run from a clean local checkout with the included demo data.

## Constraints

- The team must complete the prototype in the challenge time limit.
- Source systems use different formats.
- Source systems update at different times.
- Source information can be incomplete, old, or contradictory.
- Event date, publication date, import date, and verification date have different meanings.
- Internal records can contain confidential information.
- Source systems can have different access rules.
- The investor must make the final judgment.
- V1 supports approximately 250 companies.
- V1 does not need distributed infrastructure.

## Non-Goals

V1 will not:

- Recommend an investment action.
- Give a company or investment score.
- Replace a source system.
- Guarantee complete information.
- Build production source connections.
- Search the live web during brief generation.
- Call source systems during brief generation.
- Implement enterprise identity or access controls.
- Implement data retention controls.
- Monitor all sources continuously.
- Send automatic alerts.
- Provide portfolio-wide analysis.
- Support shared document editing.
- Produce reports for external investors.

## Ready for Demonstration

The prototype is ready when all these statements are true:

- Each demo company gets a brief in 30 seconds or less.
- The retrieval result contains each specified key fact.
- A brief contains data for its company only.
- Each important fact has a valid source and date.
- The demo shows at least one old fact or conflict.
- A source file change causes a brief change or a conflict warning.
- The product runs from a clean checkout.
- The setup instructions are complete.
- RC can understand the current state without opening every source.
- RC can identify important changes, risks, and next questions.

## Primary Success Measures

- **Brief time:** 30 seconds or less.
- **Source coverage:** Each important fact has a source.
- **Company separation:** Tests find no information from a different company.
- **Key fact retrieval:** The product retrieves all specified key facts in the demo data.
- **Date visibility:** Each source shows its applicable date.
- **Old data warnings:** The product gives a warning for old data.
- **Preparation value:** RC gives the brief a score of 4 out of 5 or more.
