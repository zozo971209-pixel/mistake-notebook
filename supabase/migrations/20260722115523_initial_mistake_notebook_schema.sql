create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.question_status as enum (
  'new',
  'learning',
  'reviewing',
  'mastered',
  'archived'
);

create type public.review_result as enum (
  'wrong',
  'hard',
  'correct',
  'easy'
);

create type public.ai_key_mode as enum (
  'shared',
  'browser_byok'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '新使用者',
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  color text not null default '#8b5cf6',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid,
  title text,
  chapter text,
  source text,
  question_type text,
  difficulty smallint check (difficulty between 1 and 5),
  question_text text not null check (char_length(question_text) between 1 and 20000),
  original_answer text,
  correct_answer text,
  solution_text text,
  key_concepts text[] not null default '{}',
  error_types text[] not null default '{}',
  error_note text,
  memory_tip text,
  status public.question_status not null default 'new',
  mastery_score smallint not null default 0 check (mastery_score between 0 and 100),
  interval_days integer not null default 0 check (interval_days between 0 and 3650),
  review_count integer not null default 0 check (review_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  wrong_count integer not null default 0 check (wrong_count >= 0),
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  is_favorite boolean not null default false,
  is_ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint questions_subject_owner_fk
    foreign key (subject_id, user_id)
    references public.subjects(id, user_id)
    on delete set null (subject_id)
);

create table public.review_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null,
  result public.review_result not null,
  submitted_answer text,
  used_hint boolean not null default false,
  duration_seconds integer check (duration_seconds between 0 and 86400),
  mastery_before smallint not null check (mastery_before between 0 and 100),
  mastery_after smallint not null check (mastery_after between 0 and 100),
  reviewed_at timestamptz not null default now(),
  constraint review_records_question_owner_fk
    foreign key (question_id, user_id)
    references public.questions(id, user_id)
    on delete cascade
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid,
  title text,
  mode text not null default 'tutor'
    check (mode in ('tutor', 'hint', 'socratic', 'explain', 'diagnose', 'similar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint ai_conversations_question_owner_fk
    foreign key (question_id, user_id)
    references public.questions(id, user_id)
    on delete cascade
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 30000),
  created_at timestamptz not null default now(),
  constraint ai_messages_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.ai_conversations(id, user_id)
    on delete cascade
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_key_mode public.ai_key_mode not null default 'shared',
  preferred_model text not null default 'gemini-2.5-flash-lite',
  daily_review_target integer not null default 20 check (daily_review_target between 1 and 200),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  language text not null default 'zh-TW',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('extract_question', 'tutor', 'similar')),
  model_name text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create index questions_user_created_idx on public.questions(user_id, created_at desc);
create index questions_user_review_idx on public.questions(user_id, next_review_at)
  where status <> 'archived';
create index questions_subject_idx on public.questions(subject_id);
create index questions_key_concepts_idx on public.questions using gin(key_concepts);
create index questions_error_types_idx on public.questions using gin(error_types);
create index review_records_question_idx on public.review_records(question_id, reviewed_at desc);
create index review_records_user_date_idx on public.review_records(user_id, reviewed_at desc);
create index ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at);
create index usage_records_user_action_date_idx
  on public.usage_records(user_id, action_type, created_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger questions_set_updated_at
before update on public.questions
for each row execute function private.set_updated_at();

create trigger conversations_set_updated_at
before update on public.ai_conversations
for each row execute function private.set_updated_at();

create trigger settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '新使用者')
  );

  insert into public.user_settings (user_id) values (new.id);

  insert into public.subjects (user_id, name, color, sort_order)
  values
    (new.id, '國文', '#f59e0b', 1),
    (new.id, '英文', '#06b6d4', 2),
    (new.id, '數學', '#8b5cf6', 3),
    (new.id, '物理', '#3b82f6', 4),
    (new.id, '化學', '#10b981', 5),
    (new.id, '生物', '#22c55e', 6),
    (new.id, '歷史', '#f97316', 7),
    (new.id, '地理', '#14b8a6', 8),
    (new.id, '公民', '#ec4899', 9);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function public.record_review(
  target_question_id uuid,
  review_outcome public.review_result,
  answer_text text default null,
  hint_used boolean default false,
  elapsed_seconds integer default null
)
returns public.questions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_question public.questions;
  next_mastery integer;
  next_interval integer;
  next_time timestamptz;
begin
  select * into current_question
  from public.questions
  where id = target_question_id
    and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Question not found or access denied';
  end if;

  next_mastery := greatest(0, least(100,
    current_question.mastery_score
    + case review_outcome
        when 'wrong' then -15
        when 'hard' then 5
        when 'correct' then 10
        when 'easy' then 15
      end
    - case when hint_used then 5 else 0 end
  ));

  next_interval := case review_outcome
    when 'wrong' then 0
    when 'hard' then greatest(1, round(greatest(current_question.interval_days, 1) * 1.2)::integer)
    when 'correct' then greatest(3, greatest(current_question.interval_days, 1) * 2)
    when 'easy' then greatest(7, greatest(current_question.interval_days, 1) * 3)
  end;

  next_time := case
    when review_outcome = 'wrong' then now() + interval '4 hours'
    else now() + make_interval(days => next_interval)
  end;

  insert into public.review_records (
    user_id,
    question_id,
    result,
    submitted_answer,
    used_hint,
    duration_seconds,
    mastery_before,
    mastery_after
  ) values (
    current_question.user_id,
    current_question.id,
    review_outcome,
    answer_text,
    hint_used,
    elapsed_seconds,
    current_question.mastery_score,
    next_mastery
  );

  update public.questions
  set mastery_score = next_mastery,
      interval_days = next_interval,
      review_count = review_count + 1,
      correct_count = correct_count + case when review_outcome in ('correct', 'easy') then 1 else 0 end,
      wrong_count = wrong_count + case when review_outcome = 'wrong' then 1 else 0 end,
      last_reviewed_at = now(),
      next_review_at = next_time,
      status = case
        when next_mastery >= 90 then 'mastered'::public.question_status
        when next_mastery >= 50 then 'reviewing'::public.question_status
        else 'learning'::public.question_status
      end
  where id = current_question.id
  returning * into current_question;

  return current_question;
end;
$$;

revoke all on function public.record_review(uuid, public.review_result, text, boolean, integer)
from public, anon;
grant execute on function public.record_review(uuid, public.review_result, text, boolean, integer)
to authenticated;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.review_records enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.user_settings enable row level security;
alter table public.usage_records enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "subjects_select_own" on public.subjects
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "subjects_insert_own" on public.subjects
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "subjects_update_own" on public.subjects
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "subjects_delete_own" on public.subjects
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "questions_select_own" on public.questions
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "questions_insert_own" on public.questions
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "questions_update_own" on public.questions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "questions_delete_own" on public.questions
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "reviews_select_own" on public.review_records
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "reviews_insert_own" on public.review_records
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "conversations_select_own" on public.ai_conversations
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "conversations_insert_own" on public.ai_conversations
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "conversations_update_own" on public.ai_conversations
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "conversations_delete_own" on public.ai_conversations
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "messages_select_own" on public.ai_messages
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "messages_insert_own" on public.ai_messages
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "messages_delete_own" on public.ai_messages
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "settings_select_own" on public.user_settings
for select to authenticated
using ((select auth.uid()) = user_id);
create policy "settings_update_own" on public.user_settings
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "usage_select_own" on public.usage_records
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

grant usage on schema public to authenticated;
grant usage on type public.question_status, public.review_result, public.ai_key_mode to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert on public.review_records to authenticated;
grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert, delete on public.ai_messages to authenticated;
grant select on public.user_settings to authenticated;
grant update (ai_key_mode, preferred_model, daily_review_target, theme, language)
  on public.user_settings to authenticated;
grant select on public.usage_records to authenticated;
grant usage, select on all sequences in schema public to authenticated;
