/**
 * Git working-tree status reader behind the host.gitStatus RPC.
 *
 * Runs porcelain v1 with NUL separators and maps each record onto the VS Code
 * SCM decoration letters the client renders. A missing git binary or a
 * non-repository root is a decorative miss, not an error, so the listing is
 * simply empty in either case.
 */

import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import type { GitStatusEntry, GitStatusLetter, GitStatusListing } from './api/host.ts'

/** Hard deadline for each git subprocess (rev-parse and status alike). */
export const GIT_TIMEOUT_MS = 5000

/** Upper bound on captured git stdout before execFile gives up. */
export const GIT_MAX_OUTPUT_BYTES = 4 * 1024 * 1024

/** Map one porcelain status column onto a decoration letter, or null for an undecorated column. */
function columnLetter(column: string): GitStatusLetter | null {
  if (column === 'T' || column === 'M') return 'M'
  if (column === 'A') return 'A'
  if (column === 'D') return 'D'
  if (column === 'R' || column === 'C') return 'R'
  return null
}

/**
 * Map one porcelain v1 XY pair onto a single VS Code SCM decoration letter.
 * @param x - index status column (first character).
 * @param y - worktree status column (second character).
 * @returns the decoration letter, or null when the pair carries no decoration.
 */
export function decorationLetter(x: string, y: string): GitStatusLetter | null {
  if (x === '?' && y === '?') return 'U'
  if (x === 'U' || y === 'U') return 'C'
  // The worktree column wins whenever it is non-blank; a blank worktree column
  // falls back to the index column.
  return columnLetter(y === ' ' ? x : y)
}

/**
 * Parse porcelain v1 NUL-separated output into absolute-path status entries.
 *
 * A rename or copy record (X or Y is 'R' or 'C') is followed by its pre-image
 * path as the next NUL token, which is consumed and dropped.
 * @param output - `git status --porcelain=v1 -z` stdout.
 * @param repoRoot - repository root the relative paths resolve against.
 * @returns the decorated entries, malformed tokens and undecorated records skipped.
 */
export function parsePorcelainV1(output: string, repoRoot: string): GitStatusEntry[] {
  const tokens = output.split('\0')
  const entries: GitStatusEntry[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === undefined || token.length < 4 || token.charAt(2) !== ' ') continue
    const x = token.charAt(0)
    const y = token.charAt(1)
    const status = decorationLetter(x, y)
    if (status === null) continue
    if (['R', 'C'].includes(x) || ['R', 'C'].includes(y)) index++
    entries.push({ path: resolve(repoRoot, token.slice(3)), status })
  }
  return entries
}

/** Run one git subprocess with the shared bounds; resolve stdout on exit 0 and reject otherwise. */
function runGit(
  args: readonly string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile('git', [...args], {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_OUTPUT_BYTES,
      windowsHide: true,
      ...signal === undefined ? {} : { signal },
    }, (error, stdout, stderr) => {
      if (error !== null) rejectPromise(error)
      else resolvePromise({ stdout, stderr })
    })
  })
}

/**
 * Report git working-tree status for one project root.
 *
 * Decorative by design: a missing git binary or a root outside a repository
 * resolves to an empty listing rather than an error. A caller abort rethrows
 * so the RPC layer can map it to `cancelled`.
 * @param root - the tree/workspace root to inspect.
 * @param signal - caller/connection lifetime; abort terminates the git process.
 * @returns the repository root and its decorated entries (empty when unavailable).
 */
export async function runGitStatus(
  root: string,
  signal?: AbortSignal,
): Promise<GitStatusListing> {
  let repoRoot: string
  try {
    const { stdout } = await runGit(['-C', root, 'rev-parse', '--show-toplevel'], signal)
    repoRoot = stdout.trim()
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    return { root: '', entries: [] }
  }
  try {
    const { stdout } = await runGit(
      ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
      signal,
    )
    return { root: repoRoot, entries: parsePorcelainV1(stdout, repoRoot) }
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    return { root: repoRoot, entries: [] }
  }
}
