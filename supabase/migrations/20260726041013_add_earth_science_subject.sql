create or replace function private.handle_new_user()
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
    (new.id, '公民', '#ec4899', 9),
    (new.id, '地科', '#0ea5e9', 10);

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

insert into public.subjects (user_id, name, color, sort_order)
select id, '地科', '#0ea5e9', 10
from auth.users
on conflict (user_id, name) do nothing;
