create function public.consume_ai_quota(
  action_name text,
  selected_model text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  daily_limit integer;
  used_today integer;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  daily_limit := case action_name
    when 'extract_question' then 3
    when 'tutor' then 10
    when 'similar' then 2
    else null
  end;

  if daily_limit is null then
    raise exception 'Unsupported AI action';
  end if;

  select count(*) into used_today
  from public.usage_records
  where user_id = caller_id
    and action_type = action_name
    and created_at >= date_trunc('day', now());

  if used_today >= daily_limit then
    return false;
  end if;

  insert into public.usage_records (user_id, action_type, model_name)
  values (caller_id, action_name, selected_model);

  return true;
end;
$$;

revoke all on function public.consume_ai_quota(text, text) from public, anon;
grant execute on function public.consume_ai_quota(text, text) to authenticated;
