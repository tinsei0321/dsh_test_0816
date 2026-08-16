/**
 * The project tree's viewing store: the loaded directory levels, expansion,
 * selection, load status, the hidden-row filter, and the git decoration set
 * (VS Code SCM letters for the status dots). Levels and decorations are
 * re-fetched on demand and deliberately not persisted — stale paths from a
 * previous session's workspace would only mislead. Module level exports the
 * factory only (a module-level handle would pin the store identity across
 * plugin reloads); register() receives the factory and the tree derives its
 * PropsStore share from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { GitStatusEntry, GitStatusLetter, TreeEntry } from '@deepseek-ai/dsh-client-runtime/client'

/** One loaded directory level: its rows and the Host's truncation flag. */
export interface ProjectTreeLevel {
  entries: readonly TreeEntry[]
  truncated: boolean
}

/** Per-directory load state for in-flight or failed expansions. */
export type ProjectTreeLoadStatus = 'loading' | 'error'

/** Project tree viewing state shared across surface remounts (not reloads). */
type ProjectTreeState = {
  /** The tree's root (the current workspace's path); null when no workspace is current. */
  rootPath: string | null
  /** Loaded directory levels keyed by absolute directory path (hidden rows render per `showHidden`). */
  levels: Record<string, ProjectTreeLevel>
  /** Per-directory load status for in-flight or failed expansions. */
  statuses: Record<string, ProjectTreeLoadStatus>
  /** Expanded directory paths in expansion order. */
  expanded: string[]
  /** Selected file path (the tree's row highlight). */
  selectedPath: string | null
  /** Whether hidden rows render (false = hidden, matching the directory browser). */
  showHidden: boolean
  /** Git decoration letters (VS Code SCM semantics) keyed by absolute file path. */
  gitStatuses: Record<string, GitStatusLetter>
}

/** Annotation twin of the actions literal below (the export needs a declared return type). */
type ProjectTreeActions = {
  /** Adopt a new root and drop every level, status, expansion, and selection of the old one. */
  setRoot: (draft: ProjectTreeState, path: string | null) => void
  expand: (draft: ProjectTreeState, path: string) => void
  collapse: (draft: ProjectTreeState, path: string) => void
  setLoading: (draft: ProjectTreeState, path: string) => void
  setLevel: (draft: ProjectTreeState, path: string, entries: readonly TreeEntry[], truncated: boolean) => void
  setLoadError: (draft: ProjectTreeState, path: string) => void
  select: (draft: ProjectTreeState, path: string | null) => void
  setShowHidden: (draft: ProjectTreeState, show: boolean) => void
  /** Adopt one git-status scan for the root: replace the decoration set. */
  setGitStatuses: (draft: ProjectTreeState, entries: readonly GitStatusEntry[]) => void
}

/**
 * Create the project tree viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createProjectTreeStore(): EngineStoreHandle<ProjectTreeState, ProjectTreeActions> {
  return defineStore({
    init: (): ProjectTreeState => ({
      rootPath: null,
      levels: {},
      statuses: {},
      expanded: [],
      selectedPath: null,
      showHidden: false,
      gitStatuses: {},
    }),
    actions: {
      setRoot: (d, path) => {
        d.rootPath = path
        d.levels = {}
        d.statuses = {}
        d.expanded = []
        d.selectedPath = null
        d.gitStatuses = {}
      },
      expand: (d, path) => {
        if (!d.expanded.includes(path)) d.expanded.push(path)
      },
      collapse: (d, path) => {
        d.expanded = d.expanded.filter(existing => existing !== path)
        // Rebuild without the key (no dynamic delete on the immer draft).
        d.statuses = Object.fromEntries(
          Object.entries(d.statuses).filter(([key]) => key !== path),
        )
      },
      setLoading: (d, path) => { d.statuses[path] = 'loading' },
      setLevel: (d, path, entries, truncated) => {
        d.levels[path] = { entries, truncated }
        d.statuses = Object.fromEntries(
          Object.entries(d.statuses).filter(([key]) => key !== path),
        )
      },
      setLoadError: (d, path) => { d.statuses[path] = 'error' },
      select: (d, path) => { d.selectedPath = path },
      setShowHidden: (d, show) => { d.showHidden = show },
      setGitStatuses: (d, entries) => {
        d.gitStatuses = Object.fromEntries(entries.map(entry => [entry.path, entry.status]))
      },
    },
  })
}
