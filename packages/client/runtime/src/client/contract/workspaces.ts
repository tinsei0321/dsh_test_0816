/**
 * The outward workspaces-service face — what `ctx.workspaces` exposes to
 * feature packages and the renderer host, and therefore exactly what the
 * test runtime's workspaces double must implement. Wire-pump entry points
 * (handleHostEnvelope/handleConnected/refresh/startInitialSelection) stay on
 * the concrete class. Widening this interface is the explicit act of
 * widening what features may do to the workspaces domain.
 */
import type { DirectoryListing, SessionId, TreeListing, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-remotes/client'
import type { WorkspaceListState } from '../workspaces/service.ts'
import type { ObservableSnapshot } from './store.ts'

/** Git decoration letters (VS Code SCM semantics). */
export type GitStatusLetter = 'M' | 'A' | 'D' | 'R' | 'C' | 'U'

/** One git-status record: absolute file path → decoration letter. */
export interface GitStatusEntry {
  /** Absolute path of the decorated file. */
  path: string
  /** Decoration letter describing the file's working-tree change. */
  status: GitStatusLetter
}

/** host.gitStatus response value. */
export interface GitStatusListing {
  /** Absolute path of the queried repository root. */
  root: string
  /** Decorated files in the repository's working tree. */
  entries: GitStatusEntry[]
}

/** The workspaces-service face injected as `ctx.workspaces`. */
export interface IWorkspaces {
  /** The useWorkspaces standard feed (read face — writes stay inside the domain). */
  readonly list: ObservableSnapshot<WorkspaceListState>
  /**
   * Connect a Workspace to its reusable or freshly created blank session.
   * @param workspaceId - target workspace.
   * @returns the connected session id.
   */
  connectWorkspace(workspaceId: WorkspaceId): Promise<SessionId>
  /**
   * The New Session flow: connect the explicit, current-Session, or recent
   * Workspace and open the resulting session; failures surface on the session
   * list state.
   * @param workspaceId - explicit target; omitted inherits the current
   * Session's Workspace before falling back to the recency projection.
   */
  startSession(workspaceId?: WorkspaceId): void
  /**
   * Register an existing path as a Workspace.
   * @param input - the Host create payload.
   * @returns the created or idempotently resolved Workspace.
   */
  create(input: { path: string }): Promise<WorkspaceView>
  /**
   * Open the Host's native directory picker.
   * @returns the selected path, or null when the user cancelled.
   */
  pickDirectory(): Promise<string | null>
  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list; absent lists the Host home directory.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's listing with breadcrumb ancestry.
   */
  listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>
  /**
   * List one directory level for a tree through the Host's `browse`
   * capability: files and directories together, no ancestry (the tree's
   * root is caller-owned, so the path is required).
   * @param path - absolute directory to list.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's children with their kinds.
   */
  listTreeEntries(path: string, signal?: AbortSignal): Promise<TreeListing>
  /**
   * Read one text file's content through the Host's `browse` capability
   * (the '@' file reference serializes it inline).
   * @param path - absolute file to read.
   * @param signal - aborts the wire request (and the Host's read).
   * @returns the file's decoded UTF-8 content.
   */
  readText(path: string, signal?: AbortSignal): Promise<string>
  /**
   * Read one repository working tree's git decoration status through the
   * Host's `browse` capability (decorative tree status). An empty listing
   * means the path is not a git repository or git is unavailable.
   * @param path - absolute repository (or in-repo) path to query.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the repository root and its decorated entries.
   */
  gitStatus(path: string, signal?: AbortSignal): Promise<GitStatusListing>
  /**
   * Create one child directory through the Host's `browse` capability.
   * @param path - absolute existing parent directory.
   * @param name - single non-blank path segment.
   * @returns the created directory's absolute path.
   */
  createDirectory(path: string, name: string): Promise<string>
  /**
   * Open a filesystem path with the Host operating system's default application.
   * @param path - absolute or host-resolvable path.
   */
  openPath(path: string): Promise<void>
  /**
   * Rename a Workspace.
   * @param workspaceId - target workspace.
   * @param title - the new display title.
   * @returns the updated Workspace view.
   */
  rename(workspaceId: WorkspaceId, title: string): Promise<WorkspaceView>
  /**
   * Delete a Workspace (its sessions fall back to the unaccounted group).
   * @param workspaceId - target workspace.
   */
  delete(workspaceId: WorkspaceId): Promise<void>
  /**
   * Move a Workspace within the registry display order.
   * @param workspaceId - Workspace to move.
   * @param beforeWorkspaceId - Anchor workspace; omitted appends.
   */
  insertBefore(workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId): Promise<void>
  /**
   * Move an accounted session within/into a Workspace's ordered list.
   * @param workspaceId - target workspace.
   * @param sessionId - accounted session to move.
   * @param beforeSessionId - accounted anchor to insert before; omitted appends.
   * @returns the updated Workspace view.
   */
  insertSessionBefore(workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId): Promise<WorkspaceView>
  /**
   * Archive a session into the registry-global set (hidden from grouping
   * surfaces; session log and accounting slot remain). Archiving the current
   * session clears the selection into the New Session view state.
   * @param sessionId - session to archive.
   */
  archiveSession(sessionId: SessionId): Promise<void>
}
