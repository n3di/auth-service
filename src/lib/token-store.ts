import { sql } from '@/lib/db';

type SaveUserTokenInput = {
  userId: string;
  login: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: Date;
};

export async function saveUserToken(input: SaveUserTokenInput) {
  await sql`
    insert into public.twitch_oauth_tokens
      (user_id, login, access_token, refresh_token, scopes, expires_at, updated_at)
    values
      (${input.userId}, ${input.login}, ${input.accessToken}, ${input.refreshToken}, ${input.scopes}, ${input.expiresAt.toISOString()}, now())
    on conflict (user_id) do update set
      login = excluded.login,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      scopes = excluded.scopes,
      expires_at = excluded.expires_at,
      updated_at = now()
  `;
  console.log('[TWITCH OAUTH OK]', {
    userId: input.userId,
    login: input.login,
    scopes: input.scopes,
    expiresAt: input.expiresAt.toISOString(),
  });
}
