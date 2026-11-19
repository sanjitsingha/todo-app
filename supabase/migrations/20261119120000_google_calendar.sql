-- Google Calendar for Dooist: each person's todos are written, one way, to a "Dooist"
-- calendar in their Google account by the google-calendar Edge Function
-- (supabase/functions/google-calendar). Nothing comes back from Google into the app.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
-- Setup steps for Google and the function: supabase/GOOGLE_SETUP.md.

-- Connections ------------------------------------------------------------------
-- One row per person who has connected. The app reads its own row (to show Connected
-- in Profile, and to know whether to ask for a sync); only the Edge Function writes it.

create table public.calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  connected boolean not null default false,
  -- The Google account it's connected to, to show in Profile.
  google_email text,
  -- The "Dooist" calendar the function made. Kept after disconnecting, so connecting the
  -- same Google account again reuses it rather than making a second one.
  calendar_id text,
  -- The phone's time zone when it connected (IANA name): timed todos are placed in it.
  time_zone text not null default 'UTC',
  -- How far the todos have been sent: the last one, by (updated_at, id).
  synced_until timestamptz,
  synced_until_id text,
  -- True while a newly made calendar is first being filled: deleted todos have no events
  -- in it yet, so they're skipped rather than deleted one by one.
  fresh_calendar boolean not null default false,
  -- Why it stopped, when it did by itself: 'revoked' (access removed in the Google
  -- account) or 'calendar_deleted' (the Dooist calendar was deleted in Google Calendar).
  last_error text,
  updated_at timestamptz not null default now()
);

comment on table public.calendar_connections is
  'Dooist: Google Calendar connection per user. Read by the app; written by the google-calendar Edge Function.';

create trigger calendar_connections_set_updated_at
  before insert or update on public.calendar_connections
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;

create policy "Users can read their own calendar connection"
  on public.calendar_connections for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.calendar_connections from anon, authenticated;
grant select on public.calendar_connections to authenticated;
grant all on public.calendar_connections to service_role;

-- Google tokens ----------------------------------------------------------------
-- The refresh token Google gives when someone connects, and the latest short-lived access
-- token made from it. Never readable from the app: row level security is on with no
-- policies, and only the Edge Function's secret key (service_role) has grants.

create table public.google_calendar_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.google_calendar_tokens is
  'Dooist: Google OAuth tokens for Calendar. Server only (google-calendar Edge Function).';

create trigger google_calendar_tokens_set_updated_at
  before insert or update on public.google_calendar_tokens
  for each row execute function public.set_updated_at();

alter table public.google_calendar_tokens enable row level security;

revoke all on public.google_calendar_tokens from anon, authenticated;
grant all on public.google_calendar_tokens to service_role;

-- Connect requests -------------------------------------------------------------
-- One row per "Connect Google Calendar" in progress: the random `state` sent to Google,
-- which ties Google's reply back to the person who asked, and where to send the app after.
-- Used once, then deleted. Server only, like the tokens.

create table public.google_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The app link to return to: todoapp://calendar-connected (exp://… in Expo Go).
  redirect_to text not null,
  time_zone text not null,
  created_at timestamptz not null default now()
);

comment on table public.google_oauth_states is
  'Dooist: pending Google Calendar connect requests (OAuth state). Server only.';

alter table public.google_oauth_states enable row level security;

revoke all on public.google_oauth_states from anon, authenticated;
grant all on public.google_oauth_states to service_role;
