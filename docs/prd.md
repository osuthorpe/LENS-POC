# Portfolio Intelligence Brief - Product Requirements

**Status:** Draft

## 1. Insight

AIVC investors have enough company information. They cannot collect and check the information quickly.

The information is in these sources:

- Customer relationship management (CRM) records
- Meeting notes
- Slack messages
- Public filings
- Public news

An investor must search each source. The investor must find the newest facts. The investor must also compare facts that do not agree. This work can take 90 minutes for one company.

An artificial intelligence (AI) summary is not sufficient. The investor must know the source of each important fact. The investor must also know the date and the level of uncertainty.

The product must reduce the preparation time to 30 seconds or less. The investor must continue to make the final judgment.

The primary insight is:

> The best brief does not include all available information. It includes the current facts, changes, risks, and open questions that the investor can check and use.

## 2. Jobs to Be Done

### Primary job

When I prepare for a company discussion, help me find the current facts from all approved sources. Then I can use my time for judgment, not for search and comparison.

### Functional jobs

The user must be able to:

- Understand the current state of the company.
- See important changes since the last review.
- Find financial, operating, product, team, and funding information.
- Compare new information with old information.
- Find facts that do not agree.
- Find missing information.
- Open the source for each important fact.
- Prepare questions for the next discussion.
- Share a brief with the investment team.

### Emotional jobs

The user wants to:

- Feel prepared for an important discussion.
- Know that the system did not hide an important change.
- Avoid the use of old or unsupported information.
- Keep control of the final judgment.

### Social jobs

The user wants to:

- Show a good understanding of the company.
- Give clear updates to the partners.
- Ask the founders useful questions.
- Avoid questions that the company answered before.

## 3. User Profile

### Primary user: RC before a company discussion

RC is a principal at AIVC. He monitors approximately 50 portfolio companies and 200 pipeline companies.

RC uses the product before one of these events:

- A founder meeting
- A portfolio review
- A partner discussion
- An unexpected request for a company update

RC knows the company. However, he might not know its recent state. The new information is in different source systems. RC does not know which source has the newest fact.

RC has little time. He does not need all available information. He needs answers to these questions:

- What is true now?
- What changed?
- Which changes are important?
- Which sources do not agree?
- Which information is missing or old?
- Which questions must he ask next?

RC starts with incomplete and old context. The product must give him a current and supported view.

| Starting state | Required state |
| --- | --- |
| RC knows the company, but his information is old. | RC understands the current state of the company. |
| The information is in different systems. | The product shows the important evidence in one place. |
| RC does not know which facts are current. | The product shows dates and conflicts. |
| RC thinks that information can be missing. | The product shows the known gaps. |
| RC spends time on search and copy tasks. | RC spends time on review and judgment. |
| RC does not know which questions to ask. | RC has focused questions for the next discussion. |

The product succeeds when RC can prepare without a full manual search.

### Secondary users

An associate can prepare a first brief for a principal or a partner. The associate needs clear evidence and a repeatable structure.

A partner can request a fast company update. The partner needs a short brief and access to the source evidence.

V1 must first support RC before a company discussion.

## 4. Constraints

### Time

- The product must return a useful brief in 30 seconds or less.
- The user must not open each source system before the request.
- The prototype must show the complete basic process.

### Source data

- Source systems use different formats.
- Some records do not have a clear company identifier.
- A company can have different names in different sources.
- Each source can update at a different time.

### Dates and conflicts

- New information can disagree with old information.
- A recent import can contain an old fact.
- The system must keep the event date.
- The system must keep the publication date.
- The system must keep the import date.
- The system must keep the verification date.
- The system must show conflicts.
- The system must show old or missing information.

### Trust

- Each important fact must have a source reference.
- The user must be able to open the source context.
- The product must identify generated analysis.
- The product must not show an unsupported statement as a fact.
- The product must show uncertainty and incomplete coverage.

### Security

- Internal records can contain confidential information.
- A production system must use the access rules from each source.
- A brief must not show information that the user cannot access.
- Logs and prompts must not expose confidential information.
- A production system must keep an audit record.

### Human judgment

- The product can show signals, risks, conflicts, and suggested questions.
- The product must not make an investment recommendation.
- The investor makes the final decision.
- The user must be able to correct a fact.
- The user must be able to mark an old fact as replaced.

### Scale

- V1 must support approximately 250 companies.
- V1 does not need distributed infrastructure.
- The design must permit growth after V1.

### Prototype boundary

The prototype must show:

- More than one source type
- Retrieval for one company
- A standard brief structure
- Source references
- Source dates
- Warnings for conflicts and missing data
- Generation in 30 seconds or less

The prototype does not need:

- Production CRM or Slack connections
- Enterprise authentication
- Live web search
- Automatic company matching for all records
- Mobile support
- Automatic investment decisions
- A complete portfolio management system
