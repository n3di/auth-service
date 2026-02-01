import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`
    select table_schema, table_name
    from information_schema.tables
    where table_name = 'twitch_oauth_tokens'
    order by table_schema, table_name
  `;
  return NextResponse.json(rows);
}
