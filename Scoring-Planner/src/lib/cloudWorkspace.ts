import { supabase } from './supabase'

const LEGACY_TABLE_NAME = 'user_workspaces'
const WORKSPACES_TABLE = 'workspaces'
const MEMBERS_TABLE = 'workspace_members'
const STATE_TABLE = 'workspace_state'

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'

export type CloudWorkspaceSnapshot<T> = {
  workspaceId: string
  workspaceName: string
  role: WorkspaceRole
  workspace: T | null
}

export type WorkspaceMemberRecord = {
  id: string
  email: string
  role: WorkspaceRole
  userId: string | null
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function getDefaultWorkspaceName(email: string) {
  const prefix = email.split('@')[0]?.trim() || 'Team'
  return `${prefix}'s Workspace`
}

async function getCurrentUser() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  if (!user) {
    throw new Error('No authenticated user.')
  }

  return user
}

async function claimPendingMemberships(userId: string, email: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return
  }

  const { error } = await supabase
    .from(MEMBERS_TABLE)
    .update({ user_id: userId })
    .eq('email', normalizedEmail)
    .is('user_id', null)

  if (error) {
    throw error
  }
}

async function getLegacyWorkspace<T>(userId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from(LEGACY_TABLE_NAME)
    .select('workspace')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data?.workspace as T | undefined) ?? null
}

async function createWorkspaceBootstrap<T>(userId: string, email: string, fallbackWorkspace?: T) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const workspaceName = getDefaultWorkspaceName(email)
  const normalizedEmail = normalizeEmail(email)

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from(WORKSPACES_TABLE)
    .insert({
      name: workspaceName,
      owner_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .select('id, name')
    .single()

  if (workspaceError) {
    throw workspaceError
  }

  const { error: memberError } = await supabase.from(MEMBERS_TABLE).insert({
    workspace_id: workspaceRow.id,
    user_id: userId,
    email: normalizedEmail,
    role: 'owner',
  })

  if (memberError) {
    throw memberError
  }

  const legacyWorkspace = await getLegacyWorkspace<T>(userId)
  const initialWorkspace = legacyWorkspace ?? fallbackWorkspace ?? null

  if (initialWorkspace) {
    const { error: stateError } = await supabase.from(STATE_TABLE).upsert({
      workspace_id: workspaceRow.id,
      workspace: initialWorkspace,
      updated_at: new Date().toISOString(),
    })

    if (stateError) {
      throw stateError
    }
  }

  return {
    workspaceId: workspaceRow.id,
    workspaceName: workspaceRow.name,
    role: 'owner' as WorkspaceRole,
  }
}

async function ensureWorkspaceMembership<T>(fallbackWorkspace?: T) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const user = await getCurrentUser()
  const email = normalizeEmail(user.email ?? '')

  if (!email) {
    throw new Error('This account does not have an email address yet.')
  }

  await claimPendingMemberships(user.id, email)

  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .select('workspace_id, role, workspaces!inner(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data?.workspace_id) {
    return {
      workspaceId: data.workspace_id,
      workspaceName: (data.workspaces as { name?: string } | null)?.name ?? getDefaultWorkspaceName(email),
      role: (data.role as WorkspaceRole | null) ?? 'editor',
    }
  }

  return createWorkspaceBootstrap(user.id, email, fallbackWorkspace)
}

export async function loadCloudWorkspace<T>(fallbackWorkspace?: T): Promise<CloudWorkspaceSnapshot<T>> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const membership = await ensureWorkspaceMembership(fallbackWorkspace)
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('workspace')
    .eq('workspace_id', membership.workspaceId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data && typeof fallbackWorkspace !== 'undefined') {
    await saveCloudWorkspace(fallbackWorkspace)
    return {
      ...membership,
      workspace: fallbackWorkspace,
    }
  }

  return {
    ...membership,
    workspace: (data?.workspace as T | undefined) ?? null,
  }
}

export async function saveCloudWorkspace<T>(workspace: T) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const membership = await ensureWorkspaceMembership(workspace)
  if (membership.role === 'viewer') {
    throw new Error('This shared workspace is read-only for your account.')
  }

  const { error } = await supabase.from(STATE_TABLE).upsert({
    workspace_id: membership.workspaceId,
    workspace,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    throw error
  }

  return membership
}

export async function inviteWorkspaceMember(email: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    throw new Error('Enter an email address first.')
  }

  const membership = await ensureWorkspaceMembership()
  if (membership.role !== 'owner') {
    throw new Error('Only workspace owners can invite teammates.')
  }

  const user = await getCurrentUser()
  if (normalizeEmail(user.email ?? '') === normalizedEmail) {
    throw new Error('This email is already the current workspace owner.')
  }

  const { error } = await supabase.from(MEMBERS_TABLE).upsert(
    {
      workspace_id: membership.workspaceId,
      email: normalizedEmail,
      role: 'editor',
    },
    { onConflict: 'workspace_id,email' },
  )

  if (error) {
    throw error
  }

  return membership
}

export async function listWorkspaceMembers() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const membership = await ensureWorkspaceMembership()
  const { data, error } = await supabase
    .from(MEMBERS_TABLE)
    .select('id, email, role, user_id')
    .eq('workspace_id', membership.workspaceId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return {
    ...membership,
    members: (data ?? []).map((member) => ({
      id: member.id as string,
      email: member.email as string,
      role: member.role as WorkspaceRole,
      userId: (member.user_id as string | null) ?? null,
    })) satisfies WorkspaceMemberRecord[],
  }
}

export async function removeWorkspaceMember(memberId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const membership = await ensureWorkspaceMembership()
  if (membership.role !== 'owner') {
    throw new Error('Only workspace owners can remove teammates.')
  }

  const user = await getCurrentUser()
  const { data: memberRow, error: memberError } = await supabase
    .from(MEMBERS_TABLE)
    .select('id, user_id, role, email')
    .eq('id', memberId)
    .eq('workspace_id', membership.workspaceId)
    .maybeSingle()

  if (memberError) {
    throw memberError
  }

  if (!memberRow) {
    throw new Error('This teammate record was not found.')
  }

  if ((memberRow.user_id as string | null) === user.id) {
    throw new Error('You cannot remove your own owner account here.')
  }

  const { error } = await supabase
    .from(MEMBERS_TABLE)
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', membership.workspaceId)

  if (error) {
    throw error
  }

  return membership
}

export async function updateWorkspaceMemberRole(memberId: string, role: WorkspaceRole) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const membership = await ensureWorkspaceMembership()
  if (membership.role !== 'owner') {
    throw new Error('Only workspace owners can change teammate roles.')
  }

  const user = await getCurrentUser()
  const { data: memberRow, error: memberError } = await supabase
    .from(MEMBERS_TABLE)
    .select('id, user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', membership.workspaceId)
    .maybeSingle()

  if (memberError) {
    throw memberError
  }

  if (!memberRow) {
    throw new Error('This teammate record was not found.')
  }

  if ((memberRow.user_id as string | null) === user.id) {
    throw new Error('You cannot change your own owner role here.')
  }

  const { error } = await supabase
    .from(MEMBERS_TABLE)
    .update({ role })
    .eq('id', memberId)
    .eq('workspace_id', membership.workspaceId)

  if (error) {
    throw error
  }

  return membership
}
