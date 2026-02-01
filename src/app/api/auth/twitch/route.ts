import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const SCOPES = [
  'chat:read',
  'chat:edit',
  // dodawaj tylko to, czego realnie potrzebujesz, inaczej Twitch może się przyczepić
].join(' ');

export async function GET(req: Request) {
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const redirectUri = process.env.TWITCH_REDIRECT_URI!;
  const origin = process.env.APP_BASE_URL ?? new URL(req.url).origin;

  const state = crypto.randomUUID();

  const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', SCOPES);
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl);

  // CSRF protection - state w httpOnly cookie
  res.cookies.set('twitch_oauth_state', state, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });

  return res;
}
