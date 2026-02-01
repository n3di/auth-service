import { sql } from '@/lib/db';

export async function upsertIdentityAndToken(input: {
  twitchUserId: string;
  login: string;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  expiresAt: Date;
}) {
  const [identity] = await sql`
    insert into twitch_identities (twitch_user_id, login, updated_at)
    values (${input.twitchUserId}, ${input.login}, now())
    on conflict (twitch_user_id)
    do update set login = excluded.login, updated_at = now()
    returning id
  `;

  const identityId = identity.id as string;

  await sql`
    insert into twitch_tokens (identity_id, access_token, refresh_token, scopes, expires_at, updated_at)
    values (${identityId}, ${input.accessToken}, ${input.refreshToken}, ${input.scopes}, ${input.expiresAt}, now())
    on conflict (identity_id)
    do update set
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      scopes = excluded.scopes,
      expires_at = excluded.expires_at,
      updated_at = now()
  `;

  return identityId;
}

export async function getIdentityIdByLogin(login: string) {
  const rows = await sql`
    select id from twitch_identities where login = ${login} limit 1
  `;
  return rows[0]?.id as string | undefined;
}

export async function getIdentityIdByTwitchUserId(twitchUserId: string) {
  const rows = await sql`
    select id from twitch_identities where twitch_user_id = ${twitchUserId} limit 1
  `;
  return rows[0]?.id as string | undefined;
}

export async function setDefaultBot(
  identityId: string,
  opts?: { force?: boolean },
) {
  const force = opts?.force ?? false;

  if (force) {
    await sql`
      insert into app_settings (id, default_bot_identity_id, updated_at)
      values (true, ${identityId}, now())
      on conflict (id)
      do update set default_bot_identity_id = excluded.default_bot_identity_id,
                    updated_at = now()
    `;
    return;
  }

  await sql`
    insert into app_settings (id, default_bot_identity_id, updated_at)
    values (true, ${identityId}, now())
    on conflict (id)
    do nothing
  `;
}

export async function getDefaultBotIdentityId() {
  const rows = await sql`
    select default_bot_identity_id as id
    from app_settings
    where id = true
    limit 1
  `;
  return rows[0]?.id as string | undefined;
}

export async function upsertInstallationDefaults(input: {
  broadcasterIdentityId: string;
}) {
  const defaultBotId = await getDefaultBotIdentityId();
  if (!defaultBotId) {
    throw new Error('app_settings.default_bot_identity_id_not_set');
  }

  await sql`
    insert into bot_installations (
      broadcaster_identity_id,
      main_bot_identity_id,
      fallback_bot_identity_id,
      is_enabled,
      updated_at
    )
    values (
      ${input.broadcasterIdentityId},
      ${defaultBotId},
      ${defaultBotId},
      true,
      now()
    )
    on conflict (broadcaster_identity_id)
    do update set
      updated_at = now()
  `;
}

export async function setInstallationMainBot(input: {
  broadcasterIdentityId: string;
  mainBotIdentityId: string;
  fallbackBotIdentityId: string;
}) {
  await sql`
    insert into bot_installations (
      broadcaster_identity_id,
      main_bot_identity_id,
      fallback_bot_identity_id,
      is_enabled,
      updated_at
    )
    values (
      ${input.broadcasterIdentityId},
      ${input.mainBotIdentityId},
      ${input.fallbackBotIdentityId},
      true,
      now()
    )
    on conflict (broadcaster_identity_id)
    do update set
      main_bot_identity_id = excluded.main_bot_identity_id,
      fallback_bot_identity_id = excluded.fallback_bot_identity_id,
      is_enabled = true,
      updated_at = now()
  `;
}
