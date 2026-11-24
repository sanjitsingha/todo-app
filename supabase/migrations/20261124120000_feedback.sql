-- Feedback about the app, sent from Profile > Send Feedback (src/app/feedback.tsx).
-- Run once in the Supabase dashboard: SQL Editor > New query > paste this file > Run.
--
-- Read it in the dashboard (Table Editor > feedback). People can send feedback but
-- not read it back, change it or delete it: there's only an insert policy.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  -- Who sent it. Kept (without the person) if they delete their account.
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  -- The area it's about: the Subject sheet's values (src/constants/feedback.ts).
  subject text not null check (
    subject in ('bug', 'idea', 'todos', 'calendar', 'account', 'design', 'other')
  ),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  -- Which app and phone it came from, to help reproduce a problem.
  app_version text check (char_length(app_version) <= 40),
  platform text check (char_length(platform) <= 40),
  created_at timestamptz not null default now()
);

create index feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Signed-in people can send feedback as themselves, and nothing else.
create policy "Users can send feedback"
  on public.feedback for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

comment on table public.feedback is
  'Dooist: feedback sent from Profile > Send Feedback. Users can insert their own; read it here.';
