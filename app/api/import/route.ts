import { resolve } from 'node:path';
import { NextResponse } from 'next/server';
import { importFixtures } from '@/lib/ingestion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await importFixtures(resolve(process.cwd(), 'demo_data'));
    return NextResponse.json({ status: 'complete', ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'The data import failed.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
