import { NextResponse } from 'next/server';
import { getCompanies } from '@/lib/companies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ companies: await getCompanies() });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'The company data store is not ready.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 },
    );
  }
}
