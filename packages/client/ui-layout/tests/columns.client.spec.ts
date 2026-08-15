import { describe, expect, it } from 'vitest'
import {
  CENTER_MIN, clampWidth, computeColumns,
  DETAILS_DEFAULT, DETAILS_MIN, SIDEBAR_COLLAPSED, SIDEBAR_DEFAULT, SIDEBAR_MIN,
  TREE_COLLAPSED, TREE_DEFAULT, TREE_MIN,
} from '@deepseek-ai/dsh-client-ui-layout/src/client/columns.ts'

// Numeric preference form (0 = closed); helpers keep the scenario names readable.
const open = (width: number) => width
const closed = (_width: number) => 0

// Four-column call: (viewport, sidebar, details, tree — the tree is the rightmost track).
const solve = (viewport: number, sidebar: number, details: number, tree: number) =>
  computeColumns(viewport, sidebar, details, tree)

describe('clampWidth', () => {
  it('clamps into the range and rounds', () => {
    expect(clampWidth(250.4, 240, 420)).toBe(250)
    expect(clampWidth(100, 240, 420)).toBe(240)
    expect(clampWidth(9999, 240, 420)).toBe(420)
  })
})

describe('computeColumns', () => {
  it('step 1: everything fits at preferred widths', () => {
    const cols = solve(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols).toEqual({
      sidebar: SIDEBAR_DEFAULT,
      center: 1920 - SIDEBAR_DEFAULT - DETAILS_DEFAULT - TREE_DEFAULT,
      details: DETAILS_DEFAULT,
      tree: TREE_DEFAULT,
    })
  })

  it('closed sidebar and tree keep their compact rails while closed details contribute zero width', () => {
    expect(solve(1920, closed(300), closed(360), open(TREE_DEFAULT)))
      .toEqual({
        sidebar: SIDEBAR_COLLAPSED,
        center: 1920 - SIDEBAR_COLLAPSED - TREE_DEFAULT,
        details: 0,
        tree: TREE_DEFAULT,
      })
    expect(solve(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), closed(TREE_DEFAULT)))
      .toEqual({
        sidebar: SIDEBAR_DEFAULT,
        center: 1920 - SIDEBAR_DEFAULT - DETAILS_DEFAULT - TREE_COLLAPSED,
        details: DETAILS_DEFAULT,
        tree: TREE_COLLAPSED,
      })
  })

  it('preferences beyond the clamp range are clamped before solving', () => {
    const cols = solve(1920, open(9999), open(1), open(9999))
    expect(cols.sidebar).toBe(420)
    expect(cols.details).toBe(DETAILS_MIN)
    expect(cols.tree).toBe(400)
    expect(solve(1920, open(1), open(DETAILS_DEFAULT), open(TREE_DEFAULT)).sidebar).toBe(SIDEBAR_MIN)
    expect(solve(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(1)).tree).toBe(TREE_MIN)
  })

  it('step 2: details shrinks first, center pinned at min, the tree holds', () => {
    // 280 + 480 + 240 + 640 = 1640 > 1500; details concedes to 1500-280-240-640 = 340.
    const cols = solve(1500, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: CENTER_MIN, details: 340, tree: TREE_DEFAULT })
  })

  it('step 3: details auto-closes when its min still starves center — the tree holds', () => {
    // 280 + 300 + 240 + 640 = 1460 > 1200 — details 0; center pinned at 640.
    const cols = solve(1200, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: CENTER_MIN, details: 0, tree: TREE_DEFAULT })
  })

  it('step 4: the tree shrinks toward its min before collapsing', () => {
    // 280 + 240 + 640 = 1160 > 1140; tree concedes to 1140-280-640 = 220.
    const cols = solve(1140, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: CENTER_MIN, details: 0, tree: 220 })
  })

  it('step 5: the tree collapses to its rail when its min still starves center — sidebar holds', () => {
    // 280 + 200 + 640 = 1120 > 1100 — tree rail 32; center = 1100-280-32 = 788.
    const cols = solve(1100, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols).toEqual({ sidebar: SIDEBAR_DEFAULT, center: 788, details: 0, tree: TREE_COLLAPSED })
  })

  it('the sidebar never concedes: center absorbs the deficit below CENTER_MIN', () => {
    // 700 < 280+32: sidebar keeps 280, tree keeps its rail, center takes 388 < CENTER_MIN.
    const cols = solve(700, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols.sidebar).toBe(SIDEBAR_DEFAULT)
    expect(cols.tree).toBe(TREE_COLLAPSED)
    expect(cols.center).toBe(388)
    expect(cols.details).toBe(0)
  })

  it('sidebar-closed narrow window: details concedes, then the tree concedes', () => {
    const fits = solve(
      SIDEBAR_COLLAPSED + TREE_DEFAULT + CENTER_MIN,
      closed(300), open(DETAILS_DEFAULT), open(TREE_DEFAULT),
    )
    expect(fits).toEqual({
      sidebar: SIDEBAR_COLLAPSED, center: CENTER_MIN, details: 0, tree: TREE_DEFAULT,
    })
    const starved = solve(
      SIDEBAR_COLLAPSED + TREE_DEFAULT + CENTER_MIN - 1,
      closed(300), open(DETAILS_DEFAULT), open(TREE_DEFAULT),
    )
    expect(starved).toEqual({
      sidebar: SIDEBAR_COLLAPSED, center: CENTER_MIN, details: 0, tree: TREE_DEFAULT - 1,
    })
  })

  it('tiny viewport: details closes, the tree keeps its rail, center takes the remainder', () => {
    const cols = solve(400, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(cols.details).toBe(0)
    expect(cols.tree).toBe(TREE_COLLAPSED)
    expect(cols.sidebar).toBe(SIDEBAR_DEFAULT)
    expect(cols.center).toBe(Math.max(0, 400 - SIDEBAR_DEFAULT - TREE_COLLAPSED))
  })

  it('recovery is pure: re-widening restores preferred widths untouched', () => {
    const squeezed = solve(1100, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(squeezed.details).toBe(0)
    expect(squeezed.tree).toBe(TREE_COLLAPSED)
    const restored = solve(1920, open(SIDEBAR_DEFAULT), open(DETAILS_DEFAULT), open(TREE_DEFAULT))
    expect(restored.details).toBe(DETAILS_DEFAULT)
    expect(restored.tree).toBe(TREE_DEFAULT)
    expect(restored.sidebar).toBe(SIDEBAR_DEFAULT)
  })
})

describe('computeColumns —degenerate viewports', () => {
  it('sidebar closed and viewport below CENTER_MIN: details closes, tree rails, center takes the rest', () => {
    expect(solve(500, closed(300), open(DETAILS_DEFAULT), open(TREE_DEFAULT)))
      .toEqual({
        sidebar: SIDEBAR_COLLAPSED,
        center: 500 - SIDEBAR_COLLAPSED - TREE_COLLAPSED,
        details: 0,
        tree: TREE_COLLAPSED,
      })
  })
})
