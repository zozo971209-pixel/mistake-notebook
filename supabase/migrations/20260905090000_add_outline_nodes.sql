create table if not exists public.outline_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  parent_id uuid references public.outline_nodes(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, subject_id, name),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete cascade
);
alter table public.questions add column if not exists node_id uuid;
alter table public.questions drop constraint if exists questions_node_owner_fk;
alter table public.questions add constraint questions_node_owner_fk foreign key (node_id, user_id) references public.outline_nodes(id, user_id) on delete set null;
create index if not exists outline_nodes_subject_idx on public.outline_nodes(user_id, subject_id, sort_order);
create index if not exists questions_node_idx on public.questions(user_id, node_id);
alter table public.outline_nodes enable row level security;
create policy "outline_nodes_select_own" on public.outline_nodes for select to authenticated using ((select auth.uid()) = user_id);
create policy "outline_nodes_insert_own" on public.outline_nodes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "outline_nodes_update_own" on public.outline_nodes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "outline_nodes_delete_own" on public.outline_nodes for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.outline_nodes to authenticated;
