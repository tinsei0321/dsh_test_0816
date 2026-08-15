/**
 * Pure concession-chain column solver for the four-column AppFrame (session
 * sidebar | center | details | project tree — the tree is the rightmost
 * column, always present). Chain order is fixed by contract: keep center
 * >= CENTER_MIN by shrinking details, then auto-closing it, then shrinking
 * the tree toward its minimum, then collapsing it to its compact rail;
 * preferred width preferences are never rewritten, so widening the window
 * restores them. The sidebar never concedes: its rendered width is always
 * the drag preference (or the collapsed rail), and center absorbs any
 * remaining deficit as the last resort. Inputs are the layout store's plain
 * width preferences (0 = closed); a closed sidebar or tree resolves to its
 * fixed control rail while closed details resolve to zero width. The
 * SIDEBAR_AUTO_COLLAPSE breakpoint is consumed by AppFrame, which decides
 * the effective sidebar preference before solving; the solver itself stays
 * breakpoint-free.
 */

/** Resolved widths for one frame; center may drop below CENTER_MIN only at the final fallback. */
export interface Columns { sidebar: number; center: number; details: number; tree: number }

// Contract-frozen geometry: the four-column concession chain's fixed points.
/** Center column floor; only the final fallback may go below it. */
export const CENTER_MIN = 640
/** Sidebar drag clamp floor. */
export const SIDEBAR_MIN = 264
/** Sidebar drag clamp ceiling. */
export const SIDEBAR_MAX = 420
/** Sidebar width before any user drag. */
export const SIDEBAR_DEFAULT = 280
/** Closed-sidebar rail: a 24px icon column between 16px horizontal paddings. */
export const SIDEBAR_COLLAPSED = 56
/** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
 * LG breakpoint); a manual toggle below it re-expands over the squeezed center
 * (stores.ts narrowExpanded). */
export const SIDEBAR_AUTO_COLLAPSE = 1024
/** Details drag clamp floor. */
export const DETAILS_MIN = 300
/** Details drag clamp ceiling — wide enough for the Codex-style file viewer to dominate. */
export const DETAILS_MAX = 960
/** Details width before any user drag. */
export const DETAILS_DEFAULT = 480
/** Tree drag clamp floor. */
export const TREE_MIN = 200
/** Tree drag clamp ceiling. */
export const TREE_MAX = 400
/** Tree width before any user drag. */
export const TREE_DEFAULT = 240
/** Closed-tree rail: a 32px column with the re-open affordance (the tree never unmounts). */
export const TREE_COLLAPSED = 32

/**
 * Clamp a panel width into its contract range.
 * @param px - requested width.
 * @param min - range lower bound.
 * @param max - range upper bound.
 * @returns the clamped width.
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)))
}

/**
 * Solve the four column widths for one viewport frame. Pure: no hysteresis —
 * the output is a function of (viewport, preferences) only, so recovery on
 * re-widening is automatic. Preferences re-clamp here because they cross the
 * store boundary and callers may still supply stale ranges.
 * @param viewport - available frame width in px.
 * @param sidebar - sidebar width preference in px (0 = closed).
 * @param details - details width preference in px (0 = closed).
 * @param tree - tree width preference in px (0 = closed to the rail).
 * @returns resolved widths; details 0 means visually closed (never unmounted), while a closed sidebar or tree keeps its compact rail.
 */
export function computeColumns(viewport: number, sidebar: number, details: number, tree: number): Columns {
  // The sidebar and tree rails are fixed at their preferences (or the rail);
  // the sidebar never concedes, and the tree concedes only after details.
  const s = sidebar === 0 ? SIDEBAR_COLLAPSED : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const d0 = details === 0 ? 0 : clampWidth(details, DETAILS_MIN, DETAILS_MAX)
  const t0 = tree === 0 ? TREE_COLLAPSED : clampWidth(tree, TREE_MIN, TREE_MAX)

  // Step 1: everything fits at preferred widths.
  if (s + d0 + t0 + CENTER_MIN <= viewport) {
    return { sidebar: s, center: viewport - s - d0 - t0, details: d0, tree: t0 }
  }

  // Step 2: shrink details toward its minimum.
  const d1 = d0 === 0 ? 0 : Math.max(DETAILS_MIN, viewport - s - t0 - CENTER_MIN)
  if (s + d1 + t0 + CENTER_MIN <= viewport) return { sidebar: s, center: CENTER_MIN, details: d1, tree: t0 }

  // Step 3: auto-close details (derived — preferences untouched).
  const noDetails = s + t0 + CENTER_MIN <= viewport
  if (noDetails) return { sidebar: s, center: CENTER_MIN, details: 0, tree: t0 }

  // Step 4: shrink the tree toward its minimum.
  const t1 = t0 === TREE_COLLAPSED ? TREE_COLLAPSED : Math.max(TREE_MIN, viewport - s - CENTER_MIN)
  if (s + t1 + CENTER_MIN <= viewport) return { sidebar: s, center: CENTER_MIN, details: 0, tree: t1 }

  // Step 5: collapse the tree to its rail (derived — preferences untouched);
  // center absorbs any remaining deficit (may drop below CENTER_MIN).
  return { sidebar: s, center: Math.max(0, viewport - s - TREE_COLLAPSED), details: 0, tree: TREE_COLLAPSED }
}
