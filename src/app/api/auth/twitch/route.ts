import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const SCOPES_BY_MODE: Record<string, string> = {
  broadcaster: ['chat:read', 'chat:edit'].join(' '),
  service_bot: ['chat:read', 'chat:edit'].join(' '),
  custom_bot: ['chat:read', 'chat:edit'].join(' '),
};

const ALLOWED_MODES = new Set(['broadcaster', 'service_bot', 'custom_bot']);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') ?? 'broadcaster';
  const owner = url.searchParams.get('owner'); // tylko dla custom_bot (na razie)

  if (!ALLOWED_MODES.has(mode)) {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  }

  // TODO: bezpieczeństwo
  // Jeśli mode=custom_bot, owner powinien wynikać z sesji zalogowanego streamera,
  // a nie z query param. Na dziś robimy minimalnie, ale to musisz dopiąć.

  const clientId = process.env.TWITCH_CLIENT_ID!;
  const redirectUri = process.env.TWITCH_REDIRECT_URI!;
  const origin = process.env.APP_BASE_URL ?? new URL(req.url).origin;

  const state = crypto.randomUUID();
  const scope = SCOPES_BY_MODE[mode];

  const authorizeUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl);

  // CSRF state
  res.cookies.set('twitch_oauth_state', state, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });

  // tryb OAuth
  res.cookies.set('twitch_oauth_mode', mode, {
    httpOnly: true,
    secure: origin.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });

  // właściciel (dla custom bot)
  if (mode === 'custom_bot') {
    if (!owner) {
      return NextResponse.json({ error: 'missing_owner' }, { status: 400 });
    }
    res.cookies.set('twitch_oauth_owner', owner, {
      httpOnly: true,
      secure: origin.startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
    });
  }

  return res;
}
