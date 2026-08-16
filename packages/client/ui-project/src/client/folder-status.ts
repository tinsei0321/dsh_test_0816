/**
 * VS Code SCM folder-status aggregation: every ancestor directory of a
 * decorated file carries the highest-priority letter among its descendants,
 * so the tree can tint folder rows whose contents changed (VS Code merges a
 * folder's children the same way — conflict beats deletion beats modification
 * beats untracked beats added/renamed).
 */

import type { GitStatusLetter } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * VS Code's folder merge order: an unmerged conflict outranks a deletion,
 * which outranks a modification, untracked, and added/renamed.
 */
export const FOLDER_STATUS_PRIORITY: readonly GitStatusLetter[] = ['C', 'D', 'M', 'U', 'A', 'R']

/** Normalize a host path to forward slashes for cross-platform prefix math. */
export function normalizePath(path: string): string {
  return path.replaceAll('\\', '/')
}

/** True when `path` is `root` itself or a descendant of it (both already normalized). */
function underRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`)
}

/**
 * Aggregate git statuses onto ancestor directories. Every ancestor of a
 * decorated file (up to and including `root`) receives the highest-priority
 * letter of its decorated descendants; paths outside `root` are ignored, and
 * an empty root aggregates nothing.
 * @param entries - absolute path → decoration letter (any separator form).
 * @param root - the tree root the aggregation stops at.
 * @returns normalized directory path → aggregate letter.
 */
export function deriveFolderStatuses(
  entries: Readonly<Record<string, GitStatusLetter>>,
  root: string,
): Record<string, GitStatusLetter> {
  const rank = new Map<GitStatusLetter, number>(
    FOLDER_STATUS_PRIORITY.map((letter, index) => [letter, index]),
  )
  const normalizedRoot = normalizePath(root).replace(/\/+$/, '')
  const folders: Record<string, GitStatusLetter> = {}
  if (normalizedRoot === '') return folders

  const merge = (folder: string, letter: GitStatusLetter): void => {
    const existing = folders[folder]
    const letterRank = rank.get(letter) ?? Number.POSITIVE_INFINITY
    const existingRank = existing === undefined ? Number.POSITIVE_INFINITY : (rank.get(existing) ?? Number.POSITIVE_INFINITY)
    if (letterRank < existingRank) folders[folder] = letter
  }

  for (const [rawPath, letter] of Object.entries(entries)) {
    const path = normalizePath(rawPath)
    if (!underRoot(path, normalizedRoot)) continue
    let parent = path.slice(0, Math.max(path.lastIndexOf('/'), 0))
    for (;;) {
      if (parent === '' || !underRoot(parent, normalizedRoot)) break
      merge(parent, letter)
      if (parent === normalizedRoot) break
      const next = parent.slice(0, Math.max(parent.lastIndexOf('/'), 0))
      if (next === parent || next === '') break
      parent = next
    }
  }
  return folders
}
