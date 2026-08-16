import type { InputTriggerCandidate } from '@deepseek-ai/dsh-client-ui-input-trigger/client'

/** Directories the fuzzy search never descends into (heavy / vendored / cache). */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'target',
  '__pycache__', '.cache', '.venv', 'venv', '.turbo', 'coverage',
])

/** Cap on returned candidates; the walk stops once reached. */
const RESULT_CAP = 200

/** Cap on visited directories; bounds the worst-case RPC fan-out. */
const VISIT_CAP = 300

/** One tree child, the structural shape `listTreeEntries` returns per entry. */
export interface FileSearchEntry {
  readonly name: string
  readonly path: string
  readonly kind: 'file' | 'directory'
  readonly hidden: boolean
}

/** The list face the search needs — satisfied by the runtime's listTreeEntries. */
export type ListTreeEntries = (
  path: string,
  signal?: AbortSignal,
) => Promise<{ readonly entries: readonly FileSearchEntry[] }>

/**
 * Bounded depth-first fuzzy search over the workspace tree, skipping heavy
 * directories. Directories always enqueue (deeper matches need them), but only
 * surface as candidates when their own name matches; files surface on a name
 * match. The caller's abort signal stops the walk early (superseded query).
 * @param listTreeEntries - the runtime's directory-listing face.
 * @param root - the absolute workspace path the walk starts from.
 * @param query - the case-insensitive name fragment to match.
 * @param signal - aborts the walk; a superseded query cancels its predecessor.
 * @returns matched files (and matched directories) as input-trigger candidates.
 */
export async function searchWorkspaceFiles(
  listTreeEntries: ListTreeEntries,
  root: string,
  query: string,
  signal: AbortSignal,
): Promise<InputTriggerCandidate[]> {
  const q = query.toLowerCase()
  const out: InputTriggerCandidate[] = []
  const stack: string[] = [root]
  const seen = new Set<string>()
  while (stack.length > 0 && out.length < RESULT_CAP && seen.size < VISIT_CAP) {
    if (signal.aborted) return out
    const dir = stack.pop()
    if (dir === undefined || seen.has(dir)) continue
    seen.add(dir)
    let listing
    try {
      listing = await listTreeEntries(dir, signal)
    } catch {
      continue // unreadable level: skip, keep the walk alive
    }
    for (const entry of listing.entries) {
      if (out.length >= RESULT_CAP) break
      const matches = entry.name.toLowerCase().includes(q)
      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name)) continue
        if (matches) out.push({ name: entry.path, description: 'Directory' })
        stack.push(entry.path)
      } else if (matches) {
        out.push({ name: entry.path, description: 'File' })
      }
    }
  }
  return out
}

/**
 * Base name of a path (last path segment across both separators).
 * @param path - the path to take the last segment from.
 * @returns the final segment, or the whole path when it has no separator.
 */
export function basenameOf(path: string): string {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return i >= 0 ? path.slice(i + 1) : path
}
