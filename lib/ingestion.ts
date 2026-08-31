import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { pool, withTransaction } from '@/lib/db';

const companySchema = z.object({
  source_record_id: z.string(),
  company_id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  domain: z.string().nullable(),
  relationship_status: z.enum(['portfolio', 'pipeline']),
  pipeline_stage: z.string().nullable(),
  company_stage: z.string(),
  sector: z.string(),
  description: z.string(),
  relationship_owner: z.string(),
  investment_date: z.string().nullable(),
  investment_amount_usd: z.number().nullable(),
  ownership_percent: z.number().nullable(),
  last_review_date: z.string().nullable(),
  updated_at: z.string(),
});

const activitySchema = z.object({
  source_record_id: z.string(),
  company_id: z.string(),
  activity_type: z.string(),
  occurred_at: z.string(),
  modified_at: z.string(),
  owner: z.string(),
  title: z.string(),
  content: z.string(),
  next_step: z.string().nullable().optional(),
});

const slackSchema = z.object({
  source_record_id: z.string(),
  company_id: z.string(),
  channel: z.string(),
  thread_id: z.string(),
  sender: z.string(),
  occurred_at: z.string(),
  content: z.string(),
  verification_status: z.string(),
});

const newsSchema = z.object({
  source_record_id: z.string(),
  company_id: z.string(),
  publisher: z.string(),
  title: z.string(),
  published_at: z.string(),
  url: z.string(),
  content: z.string(),
});

export type CompanyInput = z.infer<typeof companySchema>;

export interface SourceRecordInput {
  id: string;
  companyId: string;
  sourceType: 'crm' | 'meeting' | 'slack' | 'news';
  title: string;
  locator: string;
  eventDate: string | null;
  publicationDate: string | null;
  modifiedDate: string | null;
  verificationStatus: string | null;
  sourceQuality: number;
  rawContent: Record<string, unknown>;
  normalizedContent: string;
  checksum: string;
}

export interface NormalizedFixtures {
  companies: CompanyInput[];
  records: SourceRecordInput[];
}

export function checksum(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function chunkText(text: string, maximumLength = 1400) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maximumLength) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text];
}

export function localEmbedding(text: string, dimensions = 1536) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const word of words) {
    const digest = createHash('sha256').update(word).digest();
    const index = digest.readUInt16BE(0) % dimensions;
    const sign = digest[2] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / length);
}

async function readJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export async function normalizeFixtures(root: string): Promise<NormalizedFixtures> {
  const rawRoot = join(root, 'raw');
  const companies = z.array(companySchema).parse(
    await readJson(join(rawRoot, 'crm', 'companies.json')),
  );
  const activities = z.array(activitySchema).parse(
    await readJson(join(rawRoot, 'crm', 'activities.json')),
  );
  const messages = z.array(slackSchema).parse(
    await readJson(join(rawRoot, 'slack', 'messages.json')),
  );
  const articles = z.array(newsSchema).parse(
    await readJson(join(rawRoot, 'news', 'articles.json')),
  );
  const companyIds = new Set(companies.map((company) => company.company_id));
  const records: SourceRecordInput[] = [];

  for (const company of companies) {
    const normalizedContent = [
      `${company.name} is a ${company.company_stage} company in ${company.sector}.`,
      company.description,
      `Relationship status: ${company.relationship_status}.`,
      company.pipeline_stage ? `Pipeline stage: ${company.pipeline_stage}.` : '',
      `Relationship owner: ${company.relationship_owner}.`,
    ].filter(Boolean).join('\n');
    records.push({
      id: company.source_record_id,
      companyId: company.company_id,
      sourceType: 'crm',
      title: `${company.name} company profile`,
      locator: 'demo_data/raw/crm/companies.json',
      eventDate: company.updated_at,
      publicationDate: null,
      modifiedDate: company.updated_at,
      verificationStatus: 'crm record',
      sourceQuality: 0.95,
      rawContent: company,
      normalizedContent,
      checksum: checksum(company),
    });
  }

  for (const activity of activities) {
    records.push({
      id: activity.source_record_id,
      companyId: activity.company_id,
      sourceType: 'crm',
      title: activity.title,
      locator: 'demo_data/raw/crm/activities.json',
      eventDate: activity.occurred_at,
      publicationDate: null,
      modifiedDate: activity.modified_at,
      verificationStatus: activity.activity_type,
      sourceQuality: activity.activity_type === 'fact_correction' ? 1 : 0.9,
      rawContent: activity,
      normalizedContent: [
        activity.title,
        activity.content,
        activity.next_step ? `Next step: ${activity.next_step}` : '',
      ].filter(Boolean).join('\n'),
      checksum: checksum(activity),
    });
  }

  const meetingRoot = join(rawRoot, 'meetings');
  const meetingFiles = (await readdir(meetingRoot))
    .filter((name) => name.endsWith('.md'))
    .sort();
  for (const fileName of meetingFiles) {
    const text = await readFile(join(meetingRoot, fileName), 'utf8');
    const parsed = matter(text);
    const data = z.object({
      source_record_id: z.string(),
      company_id: z.string(),
      meeting_type: z.string(),
      occurred_at: z.union([z.string(), z.date()]).transform((value) =>
        value instanceof Date ? value.toISOString() : value,
      ),
      participants: z.union([z.string(), z.array(z.string())]),
    }).parse(parsed.data);
    const title = parsed.content.match(/^#\s+(.+)$/m)?.[1] ?? basename(fileName, '.md');
    records.push({
      id: data.source_record_id,
      companyId: data.company_id,
      sourceType: 'meeting',
      title,
      locator: `demo_data/raw/meetings/${fileName}`,
      eventDate: data.occurred_at,
      publicationDate: null,
      modifiedDate: data.occurred_at,
      verificationStatus: 'meeting note',
      sourceQuality: 0.94,
      rawContent: { frontmatter: parsed.data, markdown: parsed.content },
      normalizedContent: parsed.content.replace(/^#.+$/m, '').trim(),
      checksum: checksum({ frontmatter: parsed.data, content: parsed.content }),
    });
  }

  for (const message of messages) {
    records.push({
      id: message.source_record_id,
      companyId: message.company_id,
      sourceType: 'slack',
      title: `#${message.channel} · ${message.sender}`,
      locator: message.thread_id,
      eventDate: message.occurred_at,
      publicationDate: null,
      modifiedDate: message.occurred_at,
      verificationStatus: message.verification_status,
      sourceQuality: message.verification_status === 'confirmed' ? 0.88 : 0.72,
      rawContent: message,
      normalizedContent: message.content,
      checksum: checksum(message),
    });
  }

  for (const article of articles) {
    records.push({
      id: article.source_record_id,
      companyId: article.company_id,
      sourceType: 'news',
      title: article.title,
      locator: article.url,
      eventDate: article.published_at,
      publicationDate: article.published_at,
      modifiedDate: article.published_at,
      verificationStatus: 'published report',
      sourceQuality: article.publisher.includes('AI') ? 0.68 : 0.74,
      rawContent: article,
      normalizedContent: `${article.title}\n${article.content}`,
      checksum: checksum(article),
    });
  }

  for (const record of records) {
    if (!companyIds.has(record.companyId)) {
      throw new Error(`Record ${record.id} has an unknown company ID.`);
    }
  }

  return { companies, records };
}

function extractFacts(record: SourceRecordInput) {
  const facts: Array<{ key: string; value: string }> = [];
  const patterns = [
    { key: 'annual_recurring_revenue', expression: /annual recurring revenue (?:is|of) ([^.]+? USD)/gi },
    { key: 'monthly_recurring_revenue', expression: /monthly recurring revenue (?:is|was) ([^.]+? USD)/gi },
    { key: 'monthly_burn', expression: /monthly burn (?:is|was|increased to) ([^.]+? USD)/gi },
    { key: 'runway', expression: /(?:reported runway (?:is|was)|has|runway is now) (approximately )?(\d+ months)/gi },
    { key: 'customer_concentration', expression: /(?:customer|customers) represent(?:s)? (\d+ percent)/gi },
  ];
  for (const pattern of patterns) {
    for (const match of record.normalizedContent.matchAll(pattern.expression)) {
      const value = match[2] ?? match[1];
      if (value) facts.push({ key: pattern.key, value: value.trim() });
    }
  }
  return facts;
}

export async function importFixtures(root: string) {
  const fixtures = await normalizeFixtures(root);
  const existing = await pool.query<{ id: string; checksum: string }>(
    'SELECT id, checksum FROM source_records',
  );
  const knownChecksums = new Map(existing.rows.map((row) => [row.id, row.checksum]));
  const changedRecords = fixtures.records.filter(
    (record) => knownChecksums.get(record.id) !== record.checksum,
  );
  const chunkEntries = changedRecords.flatMap((record) =>
    chunkText(record.normalizedContent).map((content, position) => ({
      record,
      content,
      position,
    })),
  );

  await withTransaction(async (client) => {
    for (const company of fixtures.companies) {
      await client.query(
        `INSERT INTO companies (
          id, name, aliases, domain, relationship_status, pipeline_stage,
          company_stage, sector, description, relationship_owner, investment_date,
          investment_amount_usd, ownership_percent, last_review_date, source_updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          aliases = EXCLUDED.aliases,
          domain = EXCLUDED.domain,
          relationship_status = EXCLUDED.relationship_status,
          pipeline_stage = EXCLUDED.pipeline_stage,
          company_stage = EXCLUDED.company_stage,
          sector = EXCLUDED.sector,
          description = EXCLUDED.description,
          relationship_owner = EXCLUDED.relationship_owner,
          investment_date = EXCLUDED.investment_date,
          investment_amount_usd = EXCLUDED.investment_amount_usd,
          ownership_percent = EXCLUDED.ownership_percent,
          last_review_date = EXCLUDED.last_review_date,
          source_updated_at = EXCLUDED.source_updated_at,
          updated_at = NOW()`,
        [company.company_id, company.name, company.aliases, company.domain,
          company.relationship_status, company.pipeline_stage, company.company_stage,
          company.sector, company.description, company.relationship_owner,
          company.investment_date, company.investment_amount_usd,
          company.ownership_percent, company.last_review_date, company.updated_at],
      );
    }

    for (const record of fixtures.records) {
      await client.query(
        `INSERT INTO source_records (
          id, company_id, source_type, title, source_locator, event_date,
          publication_date, source_modified_date, verified_at, access_metadata,
          verification_status, source_quality, raw_content, normalized_content, checksum
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO UPDATE SET
          company_id = EXCLUDED.company_id,
          source_type = EXCLUDED.source_type,
          title = EXCLUDED.title,
          source_locator = EXCLUDED.source_locator,
          event_date = EXCLUDED.event_date,
          publication_date = EXCLUDED.publication_date,
          source_modified_date = EXCLUDED.source_modified_date,
          ingested_at = NOW(),
          access_metadata = EXCLUDED.access_metadata,
          verification_status = EXCLUDED.verification_status,
          source_quality = EXCLUDED.source_quality,
          raw_content = EXCLUDED.raw_content,
          normalized_content = EXCLUDED.normalized_content,
          checksum = EXCLUDED.checksum,
          updated_at = NOW()`,
        [record.id, record.companyId, record.sourceType, record.title,
          record.locator, record.eventDate, record.publicationDate,
          record.modifiedDate,
          record.verificationStatus === 'confirmed' ? record.eventDate : null,
          JSON.stringify({ scope: 'demo', access: 'approved' }),
          record.verificationStatus, record.sourceQuality,
          JSON.stringify(record.rawContent), record.normalizedContent, record.checksum],
      );
    }

    for (const record of changedRecords) {
      await client.query('DELETE FROM document_chunks WHERE source_record_id = $1', [record.id]);
      await client.query('DELETE FROM facts WHERE source_record_id = $1', [record.id]);
    }

    for (const entry of chunkEntries) {
      const embedding = `[${localEmbedding(entry.content).join(',')}]`;
      await client.query(
        `INSERT INTO document_chunks (
          id, source_record_id, company_id, position, content, token_count, embedding
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::vector)`,
        [`${entry.record.id}:chunk:${entry.position}`, entry.record.id,
          entry.record.companyId, entry.position, entry.content,
          Math.ceil(entry.content.length / 4), embedding],
      );
    }

    for (const record of changedRecords) {
      for (const fact of extractFacts(record)) {
        await client.query(
          `INSERT INTO facts (
            company_id, source_record_id, fact_key, fact_value, fact_date, verification_status
          ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [record.companyId, record.id, fact.key, fact.value,
            record.eventDate ?? record.publicationDate, record.verificationStatus],
        );
      }
    }
  });

  return {
    companyCount: fixtures.companies.length,
    recordCount: fixtures.records.length,
    changedRecordCount: changedRecords.length,
    unchangedRecordCount: fixtures.records.length - changedRecords.length,
    chunkCount: chunkEntries.length,
    embeddedChunkCount: chunkEntries.length,
  };
}
