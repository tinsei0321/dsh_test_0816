/**
 * Pure derivation of the document tab's inventory from the conversation
 * snapshot: every path the session read, mutated, or discovered through a
 * path search, with the latest read window, the mutation hunks in session
 * order, and a synthesized full-file view for a created file that was never
 * read back. Everything is derived from the public runtime snapshot (the
 * legacy node list plus the running-call list) — no chat-definition internals,
 * no subscriptions. The function is a pure selector input the panel memoizes.
 * @module
 */
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { DiffHunk, ReadBlockLine } from '@deepseek-ai/dsh-client-ui-primitives'
/** Content the reader draws: the last read window or a created file's whole text. */
export interface DocumentContent {
  /** File lines in file order, each keeping its own line number. */
  lines: ReadBlockLine[]
  /** Exact total line count (the read tool's, or the created text's). */
  totalLines: number
  /** Syntax-highlighting language hint from the read tool; absent = plain text. */
  lang?: string | undefined
}
/** One path in the document tab's inventory. */
export interface DocumentEntry {
  /** The tool's model-facing path (the panel relativizes it for display). */
  path: string
  /** Content to show in the reader, or null when the session never produced file text. */
  content: DocumentContent | null
  /** Every mutation hunk for this path, in session order. */
  changes: DiffHunk[]
  /** True when the path only appears as a path-search (glob) result. */
  discoveredOnly: boolean
  /** Last session position that touched this path (stable recency sort). */
  lastIndex: number
}
/**
 * Display label: the path relativized to the workspace root when it sits
 * under it (`.` for the root itself, the raw path otherwise).
 * @param path - absolute or display-ready file path.
 * @param cwd - the workspace root to relativize against; absent keeps the path.
 * @returns the display label.
 */
export declare function displayPath(path: string, cwd: string | undefined): string
/**
 * Derive the document inventory for one session snapshot: settled tool
 * results in session order (the top-level node list mirrors the chat
 * definitions), then the still-running calls trailing behind.
 * @param snapshot - current conversation snapshot.
 * @returns entries sorted by last activity (newest first; path as the stable tiebreak).
 */
export declare function deriveDocuments(snapshot: ConversationSnapshot): DocumentEntry[]
//# sourceMappingURL=documents.d.ts.map
