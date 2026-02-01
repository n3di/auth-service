import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const [row] = await sql`
    select
      current_database() as db,
      current_schema() as schema,
      current_user as user
  `;
  return NextResponse.json(row);
}
