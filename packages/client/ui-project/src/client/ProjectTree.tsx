/**
 * ProjectTree: the frame's rightmost column, a project directory tree over
 * the current workspace. The root is derived from the workspace/session
 * projections (current session's workspace, else the recency projection);
 * directory rows lazy-load one level at a time through the Host's tree
 * listing, file rows open the details column's document reader through the
 * cross-panel opener. Pure presenter: the root derivation is a useMemo over
 * the standard hooks, every write goes through the declared viewing store,
 * and the wire face arrives through the inject share. In-flight loads are
 * canceled when a level collapses or the root changes; a load that outlives
 * a rail collapse settles into the store harmlessly (the store survives
 * remounts). Children render as nested `role="group"` levels, each carrying
 * a vertical guide line (the folder-tree "line" look) instead of flat
 * indent paddings.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutline14, IconChevronRightOutline14,
  IconCloseFill14, IconFolderClose16, IconFolderOpen16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { GitStatusLetter, TreeEntry } from '@deepseek-ai/dsh-client-runtime/client'
import type { ProjectTreeProps } from './contract/slots.ts'
import type { ProjectKey } from './locales.ts'
import { currentWorkspacePath } from './current-workspace.ts'
import { deriveFolderStatuses, normalizePath } from './folder-status.ts'
import css from './ProjectTree.module.css'

/** Locale keys of the git decoration letters (VS Code SCM semantics). */
const STATUS_LABELS: Record<GitStatusLetter, ProjectKey> = {
  M: 'project.status.M',
  A: 'project.status.A',
  D: 'project.status.D',
  R: 'project.status.R',
  C: 'project.status.C',
  U: 'project.status.U',
}

/** Base name of a host path (the root row's label). */
export function baseNameOf(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path
}

/**
 * Render the project directory tree (the frame's rightmost column).
 * @param props - composed slot props (standard hooks + store + injected face, contract/slots.ts).
 * @returns the tree element.
 */
export function ProjectTree({
  collapsed,
  useSessions,
  useWorkspaces,
  useStore,
  actions,
  listTreeEntries,
  openDocument,
  gitStatus,
  toggleColumn,
  t,
}: ProjectTreeProps) {
  const workspaces = useWorkspaces(s => s)
  const sessions = useSessions(s => s)
  const rootPath = useMemo(() => currentWorkspacePath(workspaces, sessions), [workspaces, sessions])
  const storeRoot = useStore(s => s.rootPath)
  const expanded = useStore(s => s.expanded)
  const levels = useStore(s => s.levels)
  const statuses = useStore(s => s.statuses)
  const selectedPath = useStore(s => s.selectedPath)
  const showHidden = useStore(s => s.showHidden)
  const gitStatuses = useStore(s => s.gitStatuses)
  // Ancestor tinting (VS Code's folder merge): every directory under the
  // root that contains a decorated file carries the aggregate letter.
  const folderDots = useMemo(
    () => deriveFolderStatuses(gitStatuses, rootPath ?? ''),
    [gitStatuses, rootPath],
  )

  // In-flight loads by directory path. Component-private: the map dies with
  // the tree (rail collapse), while the store carries the settled facts.
  const controllers = useRef(new Map<string, AbortController>())

  /** Launch one level load without the in-flight guard (root-change path). */
  const launch = (path: string): void => {
    const controller = new AbortController()
    controllers.current.set(path, controller)
    actions.setLoading(path)
    listTreeEntries(path, controller.signal).then(
      (listing) => {
        controllers.current.delete(path)
        if (controller.signal.aborted) return
        actions.setLevel(path, listing.entries, listing.truncated)
      },
      () => {
        controllers.current.delete(path)
        if (controller.signal.aborted) return
        actions.setLoadError(path)
      },
    )
  }

  /** Load a level unless one is in flight or already settled (toggle path). */
  const loadIfNeeded = (path: string): void => {
    if (statuses[path] === 'loading' || levels[path] !== undefined) return
    launch(path)
  }

  // Root change: cancel every stale load and rebuild from the new root,
  // auto-expanding it one level so the tree never opens bare.
  useEffect(() => {
    if (storeRoot === rootPath) return
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    actions.setRoot(rootPath)
    if (rootPath !== null) {
      actions.expand(rootPath)
      launch(rootPath)
    }
  }, [rootPath, storeRoot, actions, listTreeEntries])

  // Git decorations (the VS Code-style status dots): one scan per root. A
  // superseded scan aborts; an absent repository, missing git, or wire
  // failure settles as no decorations (the dots simply stay absent).
  const gitController = useRef<AbortController | null>(null)
  useEffect(() => {
    if (storeRoot !== rootPath) return
    gitController.current?.abort()
    const controller = new AbortController()
    gitController.current = controller
    if (rootPath === null) return
    gitStatus(rootPath, controller.signal).then(
      (listing) => {
        if (controller.signal.aborted) return
        actions.setGitStatuses(listing.entries)
      },
      () => {
        // Decorative feature: any failure means no dots.
      },
    )
  }, [rootPath, storeRoot, actions, gitStatus])

  const toggle = (path: string): void => {
    if (expanded.includes(path)) {
      controllers.current.get(path)?.abort()
      actions.collapse(path)
    } else {
      actions.expand(path)
      loadIfNeeded(path)
    }
  }

  /** The rows of one expanded level, nested one guide-line level below their directory row. */
  const renderRows = (dir: string): ReactNode => {
    const level = levels[dir]
    const rows: ReactNode[] = []
    if (level !== undefined) {
      const visible = showHidden ? level.entries : level.entries.filter(entry => !entry.hidden)
      for (const entry of visible) {
        rows.push(entry.kind === 'directory'
          ? renderDirectoryRow(entry)
          : renderFileRow(entry))
      }
      if (level.truncated) {
        rows.push(
          <div key="truncated" role="none" className={css.truncated}>
            {t('project.truncated')}
          </div>,
        )
      }
    }
    if (statuses[dir] === 'loading') {
      rows.push(
        <div key="loading" role="none" className={css.status}>
          {t('project.loading')}
        </div>,
      )
    }
    if (statuses[dir] === 'error') {
      rows.push(
        <button
          key="error"
          type="button"
          role="treeitem"
          className={clsx(css.row, css.errorRow)}
          onClick={() => { loadIfNeeded(dir) }}
        >
          {t('project.error')}
        </button>,
      )
    }
    return <div role="group">{rows}</div>
  }

  const renderDirectoryRow = (entry: TreeEntry): ReactNode => {
    const isExpanded = expanded.includes(entry.path)
    const folderLetter = folderDots[normalizePath(entry.path)]
    return (
      <div key={entry.path} role="treeitem" aria-expanded={isExpanded}>
        <button
          type="button"
          className={css.row}
          data-status={folderLetter}
          aria-label={t('project.toggle', { name: entry.name, state: isExpanded ? t('project.collapse') : t('project.expand') })}
          onClick={() => { toggle(entry.path) }}
        >
          <span className={css.chevron}>
            {isExpanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
          </span>
          {isExpanded ? <IconFolderOpen16 className={css.folder} /> : <IconFolderClose16 className={css.folder} />}
          <span className={css.name}>{entry.name}</span>
        </button>
        {isExpanded && renderRows(entry.path)}
      </div>
    )
  }

  const renderFileRow = (entry: TreeEntry): ReactNode => {
    const letter = gitStatuses[entry.path]
    return (
      <div
        key={entry.path}
        role="treeitem"
        aria-selected={selectedPath === entry.path}
        className={clsx(selectedPath === entry.path && css.selectedItem)}
      >
        <button
          type="button"
          className={css.row}
          aria-label={t('project.open', { name: entry.name })}
          onClick={() => {
            actions.select(entry.path)
            openDocument(entry.path)
          }}
        >
          <span className={css.chevron} aria-hidden="true" />
          {letter !== undefined && (
            <span
              className={css.dot}
              data-status={letter}
              role="img"
              title={t(STATUS_LABELS[letter])}
              aria-label={t(STATUS_LABELS[letter])}
            />
          )}
          <span className={css.name}>{entry.name}</span>
        </button>
      </div>
    )
  }

  const rootExpanded = rootPath !== null && expanded.includes(rootPath)
  const rootLetter = rootPath === null ? undefined : folderDots[normalizePath(rootPath)]

  // The collapsed rail: a single re-open affordance (Codex's sidebar toggle),
  // keeping the column mounted so a tap restores the tree.
  if (collapsed) {
    return (
      <div className={css.rail} aria-label={t('project.section.aria')}>
        <button
          type="button"
          className={css.railToggle}
          aria-label={t('project.expandColumn')}
          onClick={() => { toggleColumn() }}
        >
          <IconChevronRightOutline14 size={16} />
        </button>
      </div>
    )
  }

  return (
    <section className={css.root} aria-label={t('project.section.aria')}>
      <header className={css.header}>
        <span className={css.label}>{t('project.section')}</span>
        <button
          type="button"
          className={css.showHidden}
          aria-pressed={showHidden}
          onClick={() => { actions.setShowHidden(!showHidden) }}
        >
          {t('project.showHidden')}
        </button>
        <button
          type="button"
          className={css.collapse}
          aria-label={t('project.collapseColumn')}
          onClick={() => { toggleColumn() }}
        >
          <IconCloseFill14 size={12} />
        </button>
      </header>
      {rootPath === null
        ? <div className={css.empty}>{t('project.empty')}</div>
        : (
          <div className={css.tree} role="tree">
            <div role="treeitem" aria-expanded={rootExpanded}>
              <button
                type="button"
                className={css.rootRow}
                data-status={rootLetter}
                aria-label={t('project.toggle', { name: baseNameOf(rootPath), state: rootExpanded ? t('project.collapse') : t('project.expand') })}
                onClick={() => { toggle(rootPath) }}
              >
                <span className={css.chevron}>
                  {rootExpanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
                </span>
                {rootExpanded ? <IconFolderOpen16 className={css.folder} /> : <IconFolderClose16 className={css.folder} />}
                <span className={css.name}>{baseNameOf(rootPath)}</span>
              </button>
              {rootExpanded && renderRows(rootPath)}
            </div>
          </div>
        )}
    </section>
  )
}
