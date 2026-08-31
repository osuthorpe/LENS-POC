import { pool } from '@/lib/db';
import type { Company } from '@/lib/types';

interface CompanyRow {
  id: string;
  name: string;
  aliases: string[];
  relationship_status: 'portfolio' | 'pipeline';
  pipeline_stage: string | null;
  company_stage: string;
  sector: string;
  description: string;
  relationship_owner: string;
  last_review_date: Date | null;
  source_updated_at: Date;
  source_count: string;
  latest_source_date: Date | null;
  source_categories: string[] | null;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    relationshipStatus: row.relationship_status,
    pipelineStage: row.pipeline_stage,
    companyStage: row.company_stage,
    sector: row.sector,
    description: row.description,
    owner: row.relationship_owner,
    lastReviewDate: toIso(row.last_review_date),
    updatedAt: row.source_updated_at.toISOString(),
    sourceCount: Number(row.source_count),
    latestSourceDate: toIso(row.latest_source_date),
    sourceCategories: row.source_categories ?? [],
  };
}

const companyQuery = `
  SELECT
    c.*,
    COUNT(sr.id)::text AS source_count,
    MAX(COALESCE(sr.event_date, sr.publication_date, sr.source_modified_date)) AS latest_source_date,
    ARRAY_REMOVE(ARRAY_AGG(DISTINCT sr.source_type), NULL) AS source_categories
  FROM companies c
  LEFT JOIN source_records sr ON sr.company_id = c.id
`;

export async function getCompanies() {
  const result = await pool.query<CompanyRow>(`${companyQuery}
    GROUP BY c.id
    ORDER BY
      CASE c.relationship_status WHEN 'portfolio' THEN 0 ELSE 1 END,
      c.name
  `);
  return result.rows.map(mapCompany);
}

export async function getCompany(companyId: string) {
  const result = await pool.query<CompanyRow>(`${companyQuery}
    WHERE c.id = $1
    GROUP BY c.id
  `, [companyId]);
  const row = result.rows[0];
  return row ? mapCompany(row) : null;
}
