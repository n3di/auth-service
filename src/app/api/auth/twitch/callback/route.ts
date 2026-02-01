import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  upsertIdentityAndToken,
  getIdentityIdByLogin,
  upsertInstallationDefaults,
  setInstallationMainBot,
  getIdentityIdByTwitchUserId,
  getDefaultBotIdentityId,
  setDefaultBot,
} from '@/lib/token-store';

export async function GET(req: Request) {
  const url = new URL(req.url);

  const error = url.searchParams.get('error');
  if (error) {
    const desc = url.searchParams.get('error_description');
    return NextResponse.json({ error, desc }, { status: 400 });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json(
      { error: 'missing_code_or_state' },
      { status: 400 },
    );
  }

  const jar = await cookies();

  const cookieState = jar.get('twitch_oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: 'invalid_state' }, { status: 400 });
  }

  const mode = jar.get('twitch_oauth_mode')?.value ?? 'broadcaster';
  const owner = jar.get('twitch_oauth_owner')?.value; // tylko custom_bot

  const clientId = process.env.TWITCH_CLIENT_ID!;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET!;
  const redirectUri = process.env.TWITCH_REDIRECT_URI!;
  const baseUrl = process.env.APP_BASE_URL ?? url.origin;

  // exchange code -> token
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return NextResponse.json(
      { error: 'token_exchange_failed', body },
      { status: 500 },
    );
  }

  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope?: string[];
  };

  // validate -> user_id, login, scopes, expires_in
  const validateRes = await fetch('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token.access_token}` },
  });

  if (!validateRes.ok) {
    const body = await validateRes.text();
    return NextResponse.json(
      { error: 'validate_failed', body },
      { status: 500 },
    );
  }

  const validate = (await validateRes.json()) as {
    client_id: string;
    login: string;
    user_id: string;
    scopes: string[];
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + validate.expires_in * 1000);

  // zapis do nowych tabel:
  const identityId = await upsertIdentityAndToken({
    twitchUserId: validate.user_id,
    login: validate.login,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    scopes: validate.scopes,
    expiresAt,
  });

  if (mode === 'service_bot') {
    // ustaw default bota tylko jeśli jeszcze nie ustawiony
    await setDefaultBot(identityId);
  }

  // Logika instalacji
  if (mode === 'broadcaster') {
    // streamer podpina konto -> tworzysz instalację z mainem = default bot
    await upsertInstallationDefaults({
      broadcasterIdentityId: identityId,
    });
  }

  if (mode === 'custom_bot') {
    if (!owner) {
      return NextResponse.json(
        { error: 'missing_owner_cookie' },
        { status: 400 },
      );
    }

    // owner to twitch_user_id streamera, który podpina custom bota
    // TODO: tu koniecznie sprawdź w przyszłości, czy owner = zalogowany streamer z sesji
    const ownerBroadcasterId = await getIdentityIdByTwitchUserId(owner);
    if (!ownerBroadcasterId) {
      return NextResponse.json({ error: 'owner_not_found' }, { status: 400 });
    }

    // ustaw main bota na custom bot identityId, fallback na default bot
    const fallbackBotIdentityId = await getDefaultBotIdentityId();
    if (!fallbackBotIdentityId) {
      return NextResponse.json(
        { error: 'default_bot_not_configured' },
        { status: 500 },
      );
    }

    await setInstallationMainBot({
      broadcasterIdentityId: ownerBroadcasterId,
      mainBotIdentityId: identityId,
      fallbackBotIdentityId,
    });
  }

  // mode === service_bot: tylko zapis tokenu default bota, bez instalacji

  const res = NextResponse.redirect(new URL('/auth/success', baseUrl));
  res.cookies.delete('twitch_oauth_state');
  res.cookies.delete('twitch_oauth_mode');
  res.cookies.delete('twitch_oauth_owner');
  return res;
}
