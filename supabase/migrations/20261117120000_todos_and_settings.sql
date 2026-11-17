-- Todos and settings for the todo app, each row owned by the signed-in user.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
--
-- The app keeps working on the phone and syncs these tables in the background
-- (local-first). Each row belongs to one user, and row level security lets people
-- read and change only their own rows.

-- Stamps every insert and update with the server's time, so the app can ask for
-- "what changed since I last looked" without trusting phone clocks.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Todos -----------------------------------------------------------------------

create table public.todos (
  -- The app makes its own ids (so a todo made offline already has one), unique
  -- per user.
  id text not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  due_date date not null,
  -- Times of day as the app keeps them, 24-hour "HH:mm".
  due_time text check (due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  reminder_time text check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Minutes, up to a day.
  duration integer check (duration > 0 and duration <= 1440),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set instead of deleting the row, so a delete reaches the user's other devices.
  deleted_at timestamptz,
  primary key (user_id, id)
);

comment on table public.todos is
  'Todo app: one row per todo, owned by user_id. Synced from the phone; deleted_at marks deletes.';

-- For "what changed since" when the app syncs.
create index todos_user_id_updated_at_idx on public.todos (user_id, updated_at);

create trigger todos_set_updated_at
  before insert or update on public.todos
  for each row execute function public.set_updated_at();

alter table public.todos enable row level security;

create policy "Users can read their own todos"
  on public.todos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own todos"
  on public.todos for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can change their own todos"
  on public.todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own todos"
  on public.todos for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.todos to authenticated;

-- Settings --------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- Haptic Feedback in Profile.
  feedback text not null default 'tickVibrate'
    check (feedback in ('vibrate', 'tick', 'tickVibrate', 'none')),
  -- How the Today screen shows a day.
  todo_view text not null default 'list' check (todo_view in ('list', 'timeline')),
  appearance text not null default 'system' check (appearance in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'Todo app: one row of settings per user. Synced from the phone.';

create trigger user_settings_set_updated_at
  before insert or update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Users can read their own settings"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own settings"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can change their own settings"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_settings to authenticated;
