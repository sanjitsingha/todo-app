/**
 * Deletes the signed-in person's account, for good. Called by the app (Account > Delete
 * account, src/store/auth.tsx deleteAccount) as a POST, with the signed-in user's token.
 *
 * The account's rows go with it: todos, settings and the Google Calendar tables all reference
 * auth.users with `on delete cascade` (supabase/migrations). Before that, if Google Calendar is
 * connected, Dooist's access is handed back to Google; the Dooist calendar stays in the Google
 * account.
 *
 * Deploy with JWT verification off, like google-calendar, since it checks the caller's token
 * itself: `supabase functions deploy delete-account --no-verify-jwt`.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/** The project's secret key: the new `SUPABASE_SECRET_KEYS` map, or the legacy service role key. */
function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, unknown>;
      if (typeof parsed.default === 'string') return parsed.default;
    } catch {
      // Fall through to the legacy key.
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('No Supabase secret key in the environment');
}

let client: SupabaseClient | null = null;

/** A client with the secret key: it can delete users. */
function db(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The signed-in user calling, from their token, or null. */
async function caller(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** Hands Dooist's Google Calendar access back to Google, if there is any. Never throws. */
async function revokeGoogleCalendar(userId: string) {
  try {
    const { data } = await db()
      .from('google_calendar_tokens')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle();
    const refreshToken = (data as { refresh_token: string } | null)?.refresh_token;
    if (!refreshToken) return;
    const response = await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    });
    await response.body?.cancel();
  } catch (error) {
    // The account still goes; the access can also be removed in the Google account.
    console.warn('Could not revoke the Google token:', error);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'not_found' }, 404);
    const userId = await caller(req);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    await revokeGoogleCalendar(userId);
    const { error } = await db().auth.admin.deleteUser(userId);
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'server_error' }, 500);
  }
});
