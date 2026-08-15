/**
 * The tree's root derivation, as one pure function: the current session's
 * Workspace wins, else the recency projection; null when no Workspace is
 * current (the tree renders its empty state).
 */
import type { SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Resolve the tree's root path from the workspace and session projections.
 * @param workspaces - the workspace list projection.
 * @param sessions - the session list projection (the current session decides).
 * @returns the current workspace's path, or null when none is current.
 */
export function currentWorkspacePath(
  workspaces: WorkspaceListState,
  sessions: SessionListState,
): string | null {
  const current = sessions.current
  const bySession = current === undefined
    ? undefined
    : workspaces.items.find(workspace => workspace.sessionIds.includes(current))
  const target = bySession
    ?? (workspaces.recentWorkspaceId === undefined
      ? undefined
      : workspaces.items.find(workspace => workspace.workspaceId === workspaces.recentWorkspaceId))
  return target?.path ?? null
}
