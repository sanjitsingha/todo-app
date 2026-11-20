/**
 * Google Calendar for Dooist: writes each person's todos, one way, to a "Dooist" calendar in
 * their Google account. Changes made in Google Calendar don't come back to the app.
 *
 * Called by the app (supabase.functions.invoke, with the signed-in user's token) as a POST with
 * `{ action }`:
 * - `connect`: starts connecting. Gives back Google's consent page URL for the in-app browser.
 * - `sync`: sends the todos changed since the last sync (up to BATCH_SIZE a call; `more` says
 *   to call again). The app calls it after its own sync with Supabase, so it sees what's there.
 * - `disconnect`: stops, and hands the access back to Google. The calendar stays in Google.
 * - `resync`: sends every todo again, from the start (the following `sync` calls do it).
 * - `settings`: `{ syncTodos?, showEvents? }`, the Calendar page's switches.
 * - `events`: `{ from, to }`, the person's events in their primary calendar between two times,
 *   when Events is on (read-only; needs the events permission, asked for by `connect` with
 *   `withEvents`).
 *
 * Google sends the browser back to GET /google-calendar/callback (no user token there; the
 * one-time `state` says who it is), which saves the tokens, makes the calendar, and sends the
 * browser on to the app link it came from (todoapp://calendar-connected?calendar=…).
 *
 * Deploy with JWT verification off (the callback has no token), since every POST action checks
 * the caller's token itself: `supabase functions deploy google-calendar --no-verify-jwt`.
 * Needs the GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets (a Google "Web application" OAuth
 * client) and the tables in supabase/migrations/20261119120000_google_calendar.sql. Setup:
 * supabase/GOOGLE_SETUP.md.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Google ------------------------------------------------------------------------

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
/**
 * The narrowest Calendar scope that does the job: make secondary calendars, and manage events
 * on the calendars this app made. It can't see or touch the person's other calendars.
 */
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
/**
 * Reading the person's own events, for the Calendar page's Events switch. Read-only, and only
 * asked for when Events is first turned on.
 */
const EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
/** Most events one `events` call gives back. */
const MAX_EVENTS = 500;
/** The widest window `events` reads, in days. */
const MAX_EVENT_DAYS = 120;

const CALENDAR_NAME = 'Dooist';
const CALENDAR_DESCRIPTION =
  'Todos from the Dooist app. Changes made here aren’t sent back to the app.';

// The app ------------------------------------------------------------------------

/**
 * Link schemes the browser may be sent back to: the app's (app.json "scheme"), and Expo Go's
 * (exps: when the dev server is on https, such as a tunnel).
 */
const APP_SCHEMES = ['todoapp:', 'exp:', 'exps:'];

/** How long a connect request stays good for, from starting it to Google sending it back. */
const STATE_TTL_MS = 10 * 60 * 1000;
/** Todos sent per sync call. */
const BATCH_SIZE = 100;
/** Calendar requests in flight at once, per sync call. */
const CONCURRENCY = 4;
/** How long a timed todo with no duration takes up in the calendar, in minutes. */
const DEFAULT_MINUTES = 30;

// Setup --------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
/** Google sends the browser back here; it must be in the OAuth client's redirect URIs. */
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/google-calendar/callback`;

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

/**
 * A client with the secret key: it gets past row level security, so every query here filters
 * by the caller's user id itself.
 */
function db(): SupabaseClient {
  client ??= createClient(SUPABASE_URL, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Rows -----------------------------------------------------------------------------

type TodoRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  duration: number | null;
  completed: boolean;
  updated_at: string;
  deleted_at: string | null;
};

type ConnectionRow = {
  user_id: string;
  connected: boolean;
  google_email: string | null;
  calendar_id: string | null;
  time_zone: string;
  synced_until: string | null;
  synced_until_id: string | null;
  fresh_calendar: boolean;
  last_error: string | null;
  sync_todos: boolean;
  show_events: boolean;
  can_read_events: boolean;
};

type TokenRow = {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

type StateRow = {
  state: string;
  user_id: string;
  redirect_to: string;
  time_zone: string;
  with_events: boolean;
  created_at: string;
};

// Responses --------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A short note for the browser, when there's no app link to send it on to. */
function note(message: string, status = 400): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// Helpers -------------------------------------------------------------------------------

function isAppLink(value: string): boolean {
  try {
    return APP_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** An IANA time zone name the runtime knows, or UTC. */
function validTimeZone(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The email in a Google ID token (it came straight from Google's token endpoint). */
function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  try {
    const payload = idToken.split('.')[1] ?? '';
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    return typeof claims.email === 'string' ? claims.email : null;
  } catch {
    return null;
  }
}

/**
 * The event id for a todo: the same every time, so every phone and every sync writes the same
 * event, and there are no duplicates. Google allows only a-v and 0-9 in ids, so the todo's id
 * goes in as hex, after "dooist" (all letters in a-v).
 */
function eventIdFor(todoId: string): string {
  const hex = Array.from(new TextEncoder().encode(todoId), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `dooist${hex}`;
}

/** A local date and time ("YYYY-MM-DD", "HH:mm") moved on by some minutes, as "YYYY-MM-DDTHH:mm:ss". */
function addMinutes(date: string, time: string, minutes: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes));
  return moved.toISOString().slice(0, 19);
}

/** The day after "YYYY-MM-DD". */
function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * A todo as a calendar event. With a time: at that time, for its duration (or half an hour),
 * in the time zone the phone was in when it connected. Without: all day, on its due date.
 * Done todos get a tick and stop showing as busy. Google's own reminders are off: the app
 * already reminds.
 */
function toEvent(todo: TodoRow, timeZone: string): Record<string, unknown> {
  const timed = todo.due_time !== null;
  const event: Record<string, unknown> = {
    summary: todo.completed ? `✓ ${todo.title}` : todo.title,
    description: todo.description ?? '',
    status: 'confirmed',
    transparency: timed && !todo.completed ? 'opaque' : 'transparent',
    reminders: { useDefault: false },
    extendedProperties: { private: { dooistTodoId: todo.id } },
  };
  if (todo.due_time !== null) {
    event.start = { dateTime: `${todo.due_date}T${todo.due_time}:00`, timeZone };
    event.end = {
      dateTime: addMinutes(todo.due_date, todo.due_time, todo.duration ?? DEFAULT_MINUTES),
      timeZone,
    };
  } else {
    event.start = { date: todo.due_date };
    // All-day events end the day after (the end is exclusive).
    event.end = { date: nextDay(todo.due_date) };
  }
  return event;
}

/** Runs `task` on every item, at most `limit` at a time; results in the items' order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

// Google calls --------------------------------------------------------------------------

type GoogleTokens = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
};

async function googleToken(params: Record<string, string>): Promise<{ ok: boolean; body: GoogleTokens }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      ...params,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as GoogleTokens;
  return { ok: response.ok, body };
}

function calendarFetch(token: string, path: string, method: string, body?: unknown) {
  return fetch(`${CALENDAR_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Lets go of a response's body without reading it. */
async function drop(response: Response) {
  await response.body?.cancel();
}

/**
 * The Dooist calendar to write to: the one made last time, if it's still there in this Google
 * account, or a new one. `fresh` says it was just made (so it has no events yet).
 */
async function ensureCalendar(
  token: string,
  existingId: string | null,
  timeZone: string,
): Promise<{ id: string; fresh: boolean }> {
  if (existingId) {
    const found = await calendarFetch(token, `/calendars/${encodeURIComponent(existingId)}`, 'GET');
    await drop(found);
    if (found.ok) return { id: existingId, fresh: false };
  }
  const made = await calendarFetch(token, '/calendars', 'POST', {
    summary: CALENDAR_NAME,
    description: CALENDAR_DESCRIPTION,
    timeZone,
  });
  if (!made.ok) throw new Error(`calendars.insert ${made.status}: ${await made.text()}`);
  const calendar = (await made.json()) as { id: string };
  return { id: calendar.id, fresh: true };
}

class RevokedError extends Error {}

/** Marks a connection as stopped by itself, for Profile to offer Reconnect. */
async function markStopped(userId: string, reason: 'revoked' | 'calendar_deleted') {
  await db()
    .from('calendar_connections')
    .update({ connected: false, last_error: reason })
    .eq('user_id', userId);
}

/**
 * An access token for the person's Google account: the saved one while it has a minute left,
 * otherwise a new one from the refresh token. Throws RevokedError (and marks the connection
 * stopped) when Google says the access was taken back.
 */
async function accessToken(userId: string): Promise<string> {
  const { data, error } = await db()
    .from('google_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const saved = data as TokenRow | null;
  if (!saved) {
    await markStopped(userId, 'revoked');
    throw new RevokedError();
  }
  if (
    saved.access_token &&
    saved.access_token_expires_at &&
    Date.parse(saved.access_token_expires_at) > Date.now() + 60_000
  ) {
    return saved.access_token;
  }

  const { ok, body } = await googleToken({
    grant_type: 'refresh_token',
    refresh_token: saved.refresh_token,
  });
  if (!ok || !body.access_token) {
    if (body.error === 'invalid_grant') {
      await db().from('google_calendar_tokens').delete().eq('user_id', userId);
      await markStopped(userId, 'revoked');
      throw new RevokedError();
    }
    throw new Error(`Google token refresh failed: ${body.error ?? 'no access token'}`);
  }
  await db()
    .from('google_calendar_tokens')
    .update({
      access_token: body.access_token,
      access_token_expires_at: new Date(Date.now() + (body.expires_in ?? 0) * 1000).toISOString(),
    })
    .eq('user_id', userId);
  return body.access_token;
}

// Actions -------------------------------------------------------------------------------

async function connect(userId: string, body: Record<string, unknown>) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return { error: 'not_configured' };
  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : '';
  if (!isAppLink(redirectTo)) return { error: 'bad_request' };

  // One connect at a time: starting again forgets an unfinished one.
  await db().from('google_oauth_states').delete().eq('user_id', userId);
  const state = randomState();
  // From the Events switch: ask to read events too.
  const withEvents = body.withEvents === true;
  const { error } = await db().from('google_oauth_states').insert({
    state,
    user_id: userId,
    redirect_to: redirectTo,
    time_zone: validTimeZone(body.timeZone),
    with_events: withEvents,
  });
  if (error) throw error;

  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: 'code',
    scope: ['openid', 'email', CALENDAR_SCOPE, ...(withEvents ? [EVENTS_SCOPE] : [])].join(' '),
    // A refresh token, so todos can be sent long after this, and the consent screen every
    // time, so Google gives a new one even to someone who connected before.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();
  return { url: url.toString() };
}

async function callback(url: URL): Promise<Response> {
  const state = url.searchParams.get('state');
  if (!state) return note('This link isn’t complete. Go back to Dooist and try connecting again.');

  // Used once: taken out as it's read.
  const { data } = await db()
    .from('google_oauth_states')
    .delete()
    .eq('state', state)
    .select()
    .maybeSingle();
  const pending = data as StateRow | null;
  if (!pending || Date.now() - Date.parse(pending.created_at) > STATE_TTL_MS) {
    return note('This link has expired. Go back to Dooist and try connecting again.');
  }

  // Filled in once Google answers; `back` mentions it when events were asked for.
  let canReadEvents = false;

  /** On to the app, saying how it went. */
  const back = (outcome: 'connected' | 'cancelled' | 'error', reason?: string) => {
    const target = new URL(pending.redirect_to);
    target.searchParams.set('calendar', outcome);
    if (reason) target.searchParams.set('reason', reason);
    // Asked to read events, and Google's box for it was left unticked.
    if (outcome === 'connected' && pending.with_events && !canReadEvents) {
      target.searchParams.set('events', 'denied');
    }
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  };

  // "Cancel" on Google's page.
  if (url.searchParams.get('error')) return back('cancelled');
  const code = url.searchParams.get('code');
  if (!code) return back('error', 'no_code');

  const { ok, body: tokens } = await googleToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: CALLBACK_URL,
  });
  if (!ok || !tokens.access_token) {
    console.error('Google code exchange failed:', tokens.error);
    return back('error', 'exchange');
  }
  // Google lets people untick the Calendar permission on the consent screen.
  const granted = (tokens.scope ?? '').split(' ');
  if (!granted.includes(CALENDAR_SCOPE)) return back('error', 'scope');
  canReadEvents = granted.includes(EVENTS_SCOPE);
  if (!tokens.refresh_token) return back('error', 'no_refresh_token');

  const { data: existing } = await db()
    .from('calendar_connections')
    .select('calendar_id')
    .eq('user_id', pending.user_id)
    .maybeSingle();

  let calendar: { id: string; fresh: boolean };
  try {
    calendar = await ensureCalendar(
      tokens.access_token,
      (existing as { calendar_id: string | null } | null)?.calendar_id ?? null,
      pending.time_zone,
    );
  } catch (error) {
    console.error('Could not make the Dooist calendar:', error);
    return back('error', 'calendar');
  }

  const saved = await db()
    .from('google_calendar_tokens')
    .upsert({
      user_id: pending.user_id,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(
        Date.now() + (tokens.expires_in ?? 0) * 1000,
      ).toISOString(),
    });
  if (saved.error) throw saved.error;

  // Starts sending from the beginning: every todo goes (again) to the calendar. The switches
  // keep what they were, except that connecting from the Events switch turns Events on once
  // reading events is allowed.
  const connected = await db().from('calendar_connections').upsert({
    user_id: pending.user_id,
    connected: true,
    google_email: emailFromIdToken(tokens.id_token),
    calendar_id: calendar.id,
    time_zone: pending.time_zone,
    synced_until: null,
    synced_until_id: null,
    fresh_calendar: calendar.fresh,
    last_error: null,
    can_read_events: canReadEvents,
    ...(pending.with_events ? { show_events: canReadEvents } : {}),
  });
  if (connected.error) throw connected.error;

  return back('connected');
}

/**
 * What became of one todo: `sent`, `skipped` (Google won't take it, and trying again won't
 * help, so it's passed over), `retry` (rate limited, Google having trouble, no network: stop
 * here and pick up from it next time), or `calendar_gone` (the Dooist calendar was deleted).
 */
type Outcome = 'sent' | 'skipped' | 'retry' | 'calendar_gone';

function outcomeOf(status: number): Outcome {
  return status === 401 || status === 403 || status === 429 || status >= 500 ? 'retry' : 'skipped';
}

async function sendTodo(token: string, connection: ConnectionRow, todo: TodoRow): Promise<Outcome> {
  const events = `/calendars/${encodeURIComponent(connection.calendar_id ?? '')}/events`;
  const eventPath = `${events}/${eventIdFor(todo.id)}`;
  try {
    if (todo.deleted_at) {
      // A new calendar has no events yet, so there's nothing to delete.
      if (connection.fresh_calendar) return 'sent';
      const deleted = await calendarFetch(token, eventPath, 'DELETE');
      await drop(deleted);
      // Already gone is as good as deleted.
      if (deleted.ok || deleted.status === 404 || deleted.status === 410) return 'sent';
      return outcomeOf(deleted.status);
    }

    // Change the event if it's there (this also brings back one deleted in Google), or make it.
    const event = toEvent(todo, connection.time_zone);
    let response = await calendarFetch(token, eventPath, 'PUT', event);
    if (response.status === 404 || response.status === 410) {
      await drop(response);
      response = await calendarFetch(token, events, 'POST', { id: eventIdFor(todo.id), ...event });
      // Not found when adding an event: the calendar itself is gone.
      if (response.status === 404) {
        await drop(response);
        return 'calendar_gone';
      }
      // Made in the meantime (another sync at the same moment): change it instead.
      if (response.status === 409) {
        await drop(response);
        response = await calendarFetch(token, eventPath, 'PUT', event);
      }
    }
    if (response.ok) {
      await drop(response);
      return 'sent';
    }
    console.warn(`Calendar said ${response.status} for todo ${todo.id}:`, await response.text());
    return outcomeOf(response.status);
  } catch (error) {
    console.warn(`Could not send todo ${todo.id}:`, error);
    return 'retry';
  }
}

async function sync(userId: string) {
  const { data, error } = await db()
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const connection = data as ConnectionRow | null;
  if (!connection?.connected || !connection.calendar_id) {
    return { connected: false, reason: connection?.last_error ?? null };
  }
  // Todo sync is off: nothing new goes to Google, and what's there stays.
  if (!connection.sync_todos) return { connected: true, more: false };

  let token: string;
  try {
    token = await accessToken(userId);
  } catch (refreshError) {
    if (refreshError instanceof RevokedError) return { connected: false, reason: 'revoked' };
    throw refreshError;
  }

  // The todos changed since the last one sent, oldest first. Many can share one updated_at
  // (the app sends them in batches), so the id breaks ties.
  let query = db().from('todos').select('*').eq('user_id', userId);
  if (connection.synced_until) {
    const at = connection.synced_until;
    const id = connection.synced_until_id ?? '';
    query = query.or(`updated_at.gt."${at}",and(updated_at.eq."${at}",id.gt."${id}")`);
  }
  const { data: rows, error: rowsError } = await query
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(BATCH_SIZE);
  if (rowsError) throw rowsError;
  const todos = (rows ?? []) as TodoRow[];
  if (todos.length === 0) return { connected: true, more: false };

  const outcomes = await mapLimit(todos, CONCURRENCY, (todo) => sendTodo(token, connection, todo));

  if (outcomes.includes('calendar_gone')) {
    // Deleted in Google Calendar: take that as wanting it stopped, rather than making it again.
    await markStopped(userId, 'calendar_deleted');
    return { connected: false, reason: 'calendar_deleted' };
  }

  // Moves up to the last todo before the first one to try again.
  const firstRetry = outcomes.indexOf('retry');
  const done = firstRetry === -1 ? todos.length : firstRetry;
  const update: Partial<ConnectionRow> = {};
  if (done > 0) {
    update.synced_until = todos[done - 1].updated_at;
    update.synced_until_id = todos[done - 1].id;
  }
  const caughtUp = firstRetry === -1 && todos.length < BATCH_SIZE;
  if (caughtUp && connection.fresh_calendar) update.fresh_calendar = false;
  if (Object.keys(update).length > 0) {
    const saved = await db().from('calendar_connections').update(update).eq('user_id', userId);
    if (saved.error) throw saved.error;
  }

  return { connected: true, more: firstRetry === -1 && todos.length === BATCH_SIZE };
}

async function disconnect(userId: string) {
  const { data } = await db()
    .from('google_calendar_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();
  const refreshToken = (data as { refresh_token: string } | null)?.refresh_token;
  if (refreshToken) {
    try {
      const revoked = await fetch(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      });
      await drop(revoked);
    } catch (error) {
      // Still disconnected here; the access can also be removed in the Google account.
      console.warn('Could not revoke the Google token:', error);
    }
  }
  await db().from('google_calendar_tokens').delete().eq('user_id', userId);
  // calendar_id stays, so connecting the same Google account again reuses the calendar.
  const saved = await db()
    .from('calendar_connections')
    .update({
      connected: false,
      last_error: null,
      synced_until: null,
      synced_until_id: null,
      fresh_calendar: false,
      // The access is handed back, so reading events goes with it.
      can_read_events: false,
      show_events: false,
    })
    .eq('user_id', userId);
  if (saved.error) throw saved.error;
  return { connected: false };
}

/** Sends every todo again, from the start: the next `sync` calls do the sending. */
async function resync(userId: string) {
  const saved = await db()
    .from('calendar_connections')
    .update({ synced_until: null, synced_until_id: null })
    .eq('user_id', userId)
    .eq('connected', true);
  if (saved.error) throw saved.error;
  return { ok: true };
}

/**
 * The Calendar page's switches. Turning Todo sync back on sends everything again. Turning
 * Events on needs the permission to read events first: without it, this says so
 * (`needs_permission`) and the app connects again, asking for it.
 */
async function settings(userId: string, body: Record<string, unknown>) {
  const { data, error } = await db()
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const connection = data as ConnectionRow | null;
  if (!connection?.connected) return { error: 'not_connected' };

  const update: Record<string, unknown> = {};
  if (typeof body.syncTodos === 'boolean' && body.syncTodos !== connection.sync_todos) {
    update.sync_todos = body.syncTodos;
    if (body.syncTodos) {
      update.synced_until = null;
      update.synced_until_id = null;
    }
  }
  if (typeof body.showEvents === 'boolean') {
    if (body.showEvents && !connection.can_read_events) return { error: 'needs_permission' };
    update.show_events = body.showEvents;
  }
  if (Object.keys(update).length > 0) {
    const saved = await db().from('calendar_connections').update(update).eq('user_id', userId);
    if (saved.error) throw saved.error;
  }
  return { ok: true };
}

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

/**
 * The person's events in their primary Google calendar between `from` and `to` (ISO times),
 * repeating ones as separate events, for Events in Dooist. Empty when Events is off, with
 * `reason` saying why when it's not just off.
 */
async function events(userId: string, body: Record<string, unknown>) {
  const from = typeof body.from === 'string' ? Date.parse(body.from) : NaN;
  const to = typeof body.to === 'string' ? Date.parse(body.to) : NaN;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    return { error: 'bad_request' };
  }
  const until = Math.min(to, from + MAX_EVENT_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await db()
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const connection = data as ConnectionRow | null;
  if (!connection?.connected) return { events: [], reason: connection?.last_error ?? 'not_connected' };
  if (!connection.show_events) return { events: [] };
  if (!connection.can_read_events) return { events: [], reason: 'needs_permission' };

  let token: string;
  try {
    token = await accessToken(userId);
  } catch (refreshError) {
    if (refreshError instanceof RevokedError) return { events: [], reason: 'revoked' };
    throw refreshError;
  }

  const query = new URLSearchParams({
    timeMin: new Date(from).toISOString(),
    timeMax: new Date(until).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(MAX_EVENTS),
    fields: 'items(id,status,summary,location,start,end)',
  });
  const response = await calendarFetch(token, `/calendars/primary/events?${query}`, 'GET');
  if (response.status === 401 || response.status === 403) {
    // The permission was taken back (or never covered this): Events goes off until it's given.
    await drop(response);
    await db()
      .from('calendar_connections')
      .update({ can_read_events: false, show_events: false })
      .eq('user_id', userId);
    return { events: [], reason: 'needs_permission' };
  }
  if (!response.ok) throw new Error(`events.list ${response.status}: ${await response.text()}`);

  const items = ((await response.json()) as { items?: GoogleEvent[] }).items ?? [];
  return {
    events: items
      .filter((item) => item.id && item.status !== 'cancelled' && (item.start?.date || item.start?.dateTime))
      .map((item) => {
        const allDay = Boolean(item.start?.date);
        return {
          id: item.id,
          title: item.summary?.trim() || '(No title)',
          location: item.location ?? null,
          allDay,
          // All day: "YYYY-MM-DD", the end day not included. Otherwise ISO times with offsets.
          start: allDay ? item.start?.date : item.start?.dateTime,
          end: allDay ? (item.end?.date ?? item.start?.date) : (item.end?.dateTime ?? item.start?.dateTime),
        };
      }),
  };
}

// Entry --------------------------------------------------------------------------------

/** The signed-in user calling, from their token, or null. */
async function caller(req: Request): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) return null;
  const { data, error } = await db().auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    if (req.method === 'GET' && url.pathname.endsWith('/callback')) return await callback(url);
    if (req.method !== 'POST') return json({ error: 'not_found' }, 404);

    const userId = await caller(req);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case 'connect':
        return json(await connect(userId, body));
      case 'sync':
        return json(await sync(userId));
      case 'disconnect':
        return json(await disconnect(userId));
      case 'resync':
        return json(await resync(userId));
      case 'settings':
        return json(await settings(userId, body));
      case 'events':
        return json(await events(userId, body));
      default:
        return json({ error: 'bad_request' }, 400);
    }
  } catch (error) {
    console.error(error);
    return json({ error: 'server_error' }, 500);
  }
});
