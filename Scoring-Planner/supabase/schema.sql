create extension if not exists pgcrypto;

create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  workspace jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists workspace_members_workspace_email_key
on public.workspace_members (workspace_id, email);

create unique index if not exists workspace_members_workspace_user_key
on public.workspace_members (workspace_id, user_id)
where user_id is not null;

create table if not exists public.workspace_state (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  workspace jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_workspace(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

alter table public.user_workspaces enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_state enable row level security;

drop policy if exists "Users can read their own workspace" on public.user_workspaces;
create policy "Users can read their own workspace"
on public.user_workspaces
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workspace" on public.user_workspaces;
create policy "Users can insert their own workspace"
on public.user_workspaces
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workspace" on public.user_workspaces;
create policy "Users can update their own workspace"
on public.user_workspaces
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own workspace" on public.user_workspaces;
create policy "Users can delete their own workspace"
on public.user_workspaces
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Members can read workspaces" on public.workspaces;
create policy "Members can read workspaces"
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists "Users can create owned workspaces" on public.workspaces;
create policy "Users can create owned workspaces"
on public.workspaces
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "Owners can update workspaces" on public.workspaces;
create policy "Owners can update workspaces"
on public.workspaces
for update
to authenticated
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

drop policy if exists "Owners can delete workspaces" on public.workspaces;
create policy "Owners can delete workspaces"
on public.workspaces
for delete
to authenticated
using (public.is_workspace_owner(id));

drop policy if exists "Members can read workspace members" on public.workspace_members;
create policy "Members can read workspace members"
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Owners can invite workspace members" on public.workspace_members;
create policy "Owners can invite workspace members"
on public.workspace_members
for insert
to authenticated
with check (
  public.is_workspace_owner(workspace_id)
  or exists (
    select 1
    from public.workspaces
    where id = workspace_id
      and owner_user_id = auth.uid()
  )
);

drop policy if exists "Owners can update workspace members" on public.workspace_members;
create policy "Owners can update workspace members"
on public.workspace_members
for update
to authenticated
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

drop policy if exists "Owners can delete workspace members" on public.workspace_members;
create policy "Owners can delete workspace members"
on public.workspace_members
for delete
to authenticated
using (public.is_workspace_owner(workspace_id));

drop policy if exists "Members can read workspace state" on public.workspace_state;
create policy "Members can read workspace state"
on public.workspace_state
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "Editors can insert workspace state" on public.workspace_state;
create policy "Editors can insert workspace state"
on public.workspace_state
for insert
to authenticated
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Editors can update workspace state" on public.workspace_state;
create policy "Editors can update workspace state"
on public.workspace_state
for update
to authenticated
using (public.can_edit_workspace(workspace_id))
with check (public.can_edit_workspace(workspace_id));

drop policy if exists "Owners can delete workspace state" on public.workspace_state;
create policy "Owners can delete workspace state"
on public.workspace_state
for delete
to authenticated
using (public.is_workspace_owner(workspace_id));
