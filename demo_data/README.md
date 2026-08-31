# Demo Data

This directory contains fictional data for the Portfolio Intelligence Brief prototype.

Do not use this data as real investment information. All company names, people, domains, metrics, and events are fictional.

## Dataset Size

The main demo contains 10 companies:

- 2 portfolio companies
- 8 pipeline companies

This ratio represents the source brief. It is large enough to test retrieval and company separation. It is small enough for a clear demonstration.

The main demo does not contain all 250 companies. A load test can use generated records later. Generated load data must not replace the curated demo data.

## Source Types

The dataset contains these source types:

- CRM company records
- CRM activity records
- Meeting notes
- Slack messages
- Public news records

## Test Conditions

The dataset includes these test conditions:

- A newer fact that replaces an older fact
- Two sources that give different values
- An old source that needs a warning
- A company alias
- An unsupported internal statement
- Missing information for an early pipeline company

## File Layout

- `raw/crm/companies.json` contains company records.
- `raw/crm/activities.json` contains relationship and diligence records.
- `raw/meetings/` contains meeting notes in Markdown format.
- `raw/slack/messages.json` contains internal messages.
- `raw/news/articles.json` contains public records.
- `manifest.json` describes the dataset and the required test facts.
