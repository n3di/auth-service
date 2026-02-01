import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = req.headers.get('x-internal-secret');

  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rows = await sql`
    select user_id, login, access_token, refresh_token, scopes, expires_at
    from public.twitch_oauth_tokens
    order by updated_at desc
  `;

  return NextResponse.json(rows);
}
