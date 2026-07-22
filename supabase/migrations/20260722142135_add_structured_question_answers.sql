alter table public.questions
add column answer_config jsonb not null default '{"kind":"written","options":[],"correctOptionIds":[],"blankAnswers":[]}'::jsonb;

alter table public.questions
add constraint questions_answer_config_object_check
check (jsonb_typeof(answer_config) = 'object');

comment on column public.questions.answer_config is
'Structured answer UI configuration. kind is written, single_choice, multiple_choice, mixed, or fill_blank.';
