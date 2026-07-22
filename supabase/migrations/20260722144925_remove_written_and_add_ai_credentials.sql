alter table public.questions
alter column answer_config set default '{"kind":"fill_blank","options":[],"correctOptionIds":[],"blankAnswers":[]}'::jsonb;

update public.questions
set answer_config = jsonb_build_object(
  'kind', 'fill_blank',
  'options', '[]'::jsonb,
  'correctOptionIds', '[]'::jsonb,
  'blankAnswers', case
    when nullif(trim(correct_answer), '') is null then '[]'::jsonb
    else jsonb_build_array(correct_answer)
  end
),
question_type = '填充題'
where answer_config->>'kind' = 'written';

comment on column public.questions.answer_config is
'Structured answer UI configuration. kind is single_choice, multiple_choice, mixed, or fill_blank.';

create table public.user_ai_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'gemini' check (provider = 'gemini'),
  encrypted_key text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ai_credentials enable row level security;

create policy "Users manage own encrypted AI credential"
on public.user_ai_credentials
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_ai_credentials to authenticated;

comment on table public.user_ai_credentials is
'Encrypted user-owned AI provider credentials. Plaintext is never stored.';
