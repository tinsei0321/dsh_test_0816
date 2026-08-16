/**
 * ui-project slot contract: the rightmost project directory-tree column
 * (`frame.projectTree`), declared by ui-layout's root AppFrame entry
 * (declaring is claiming); this package registers the tree, so the document
 * reader in the details column and the tree sit side by side — the tree at
 * the far right edge. The owner supplies the column's live state (collapsed /
 * width); the tree derives the current workspace from the standard hooks and
 * drives everything through its own inject face and viewing store. Composing
 * this plugin out of cordis.yml leaves the column empty at zero cost.
 */
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the SlotMap merge declaring the frame's project-tree column.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { GitStatusListing, TreeListing } from '@deepseek-ai/dsh-client-runtime/client'
import type { createProjectTreeStore } from '../stores.ts'

/**
 * Owner share of the frame's project-tree column: live column state from the
 * concession solve. The tree renders nothing meaningful while collapsed; the
 * collapse toggle in the tree header drives the layout service instead.
 */
export interface ProjectSectionOwnerProps {
  /** True when the tree column is closed (the compact re-open rail). */
  collapsed: boolean
  /** Rendered column width in px (the rail width when collapsed). */
  width: number
}

/**
 * Registrant-private injected share: the wire face, the cross-panel
 * document opener, and the column-collapse toggle. All are callbacks over
 * plain data; data reads use the framework's global hooks.
 */
export type ProjectTreeInjected = {
  /**
   * List one directory level through the Host's `browse` capability.
   * @param path - absolute directory to list.
   * @param signal - aborts the wire request (and the Host's scan) when the caller supersedes it.
   * @returns the level's children with their kinds.
   */
  listTreeEntries: (path: string, signal: AbortSignal) => Promise<TreeListing>
  /** Open a file in the details column's document view (no-op without the provider). */
  openDocument: (path: string) => void
  /**
   * Fetch the repository's git working-tree status for the tree root (the
   * VS Code-style colored status dots). An empty listing means the root is
   * not in a git repository or git is unavailable.
   * @param path - the tree root to scan.
   * @param signal - aborts the wire request (and the Host's git run) when the caller supersedes it.
   */
  gitStatus: (path: string, signal: AbortSignal) => Promise<GitStatusListing>
  /** Toggle the tree column (the header ✕ and the collapsed rail's re-open button). */
  toggleColumn: () => void
}

/** Full tree props: the standard hooks, the viewing store, the injected face, and the locale seat. */
export type ProjectTreeProps =
  PropsRuntime<'frame.projectTree'>
  & PropsStore<ReturnType<typeof createProjectTreeStore>>
  & ProjectTreeInjected
  & PropsLocale<'project'>
