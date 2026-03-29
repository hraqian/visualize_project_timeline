create table if not exists public.projects (
  id text primary key,
  name text not null,
  last_modified timestamptz not null default timezone('utc', now()),
  data jsonb not null
);

create index if not exists projects_last_modified_idx
  on public.projects (last_modified desc);

alter table public.projects enable row level security;

drop policy if exists "public_can_read_projects" on public.projects;
drop policy if exists "public_can_insert_projects" on public.projects;
drop policy if exists "public_can_update_projects" on public.projects;
drop policy if exists "public_can_delete_projects" on public.projects;

create policy "public_can_read_projects"
on public.projects
for select
to anon, authenticated
using (true);

create policy "public_can_insert_projects"
on public.projects
for insert
to anon, authenticated
with check (true);

create policy "public_can_update_projects"
on public.projects
for update
to anon, authenticated
using (true)
with check (true);

create policy "public_can_delete_projects"
on public.projects
for delete
to anon, authenticated
using (true);
