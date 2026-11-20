-- The Calendar page (src/app/calendar.tsx): two switches, and whether Dooist may read the
-- person's events. Run after 20261119120000_google_calendar.sql.

alter table public.calendar_connections
  -- Todo sync: whether todos are sent to the Dooist calendar. Off, sync sends nothing new and
  -- what's there stays; turned back on, everything is sent again.
  add column sync_todos boolean not null default true,
  -- Events: whether the person's Google Calendar events show in Dooist (read-only).
  add column show_events boolean not null default false,
  -- Whether Google gave Dooist permission to read events (calendar.events.readonly). It's
  -- asked for only when Events is first turned on.
  add column can_read_events boolean not null default false;

-- A connect request started from the Events switch asks for that permission too, and turns
-- Events on once it's given.
alter table public.google_oauth_states
  add column with_events boolean not null default false;
