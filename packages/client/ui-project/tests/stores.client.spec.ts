/** Project tree viewing store: state transitions of every declared action. */
import { describe, expect, it } from 'vitest'
import { createProjectTreeStore } from '../src/client/stores.ts'

const TREE_ENTRY = { name: 'src', path: '/w/src', kind: 'directory' as const, hidden: false }

describe('createProjectTreeStore', () => {
  it('starts empty, unrooted, with hidden rows off', () => {
    const store = createProjectTreeStore().create()
    expect(store.getSnapshot()).toEqual({
      rootPath: null,
      levels: {},
      statuses: {},
      expanded: [],
      selectedPath: null,
      showHidden: false,
    })
  })

  it('setRoot adopts the new root and drops every fact of the old one', () => {
    const store = createProjectTreeStore().create()
    store.actions.setRoot('/w')
    store.actions.expand('/w')
    store.actions.setLoading('/w')
    store.actions.setLevel('/w', [TREE_ENTRY], false)
    store.actions.select('/w/src')
    store.actions.setShowHidden(true)
    store.actions.setRoot('/w2')
    expect(store.getSnapshot()).toEqual({
      rootPath: '/w2',
      levels: {},
      statuses: {},
      expanded: [],
      selectedPath: null,
      showHidden: true,
    })
  })

  it('expand is idempotent and keeps expansion order; collapse drops only the path and its status', () => {
    const store = createProjectTreeStore().create()
    store.actions.expand('/w')
    store.actions.expand('/w')
    store.actions.expand('/w/src')
    expect(store.getSnapshot().expanded).toEqual(['/w', '/w/src'])
    store.actions.setLoading('/w/src')
    store.actions.collapse('/w/src')
    expect(store.getSnapshot().expanded).toEqual(['/w'])
    expect(store.getSnapshot().statuses).toEqual({})
  })

  it('setLevel stores the rows and clears the status; a failed load records error', () => {
    const store = createProjectTreeStore().create()
    store.actions.setLoading('/w')
    expect(store.getSnapshot().statuses).toEqual({ '/w': 'loading' })
    store.actions.setLevel('/w', [TREE_ENTRY], true)
    const settled = store.getSnapshot()
    expect(settled.levels).toEqual({ '/w': { entries: [TREE_ENTRY], truncated: true } })
    expect(settled.statuses).toEqual({})
    store.actions.setLoadError('/w')
    expect(store.getSnapshot().statuses).toEqual({ '/w': 'error' })
    // A later success overwrites the error and the stale level.
    store.actions.setLevel('/w', [], false)
    expect(store.getSnapshot().statuses).toEqual({})
    expect(store.getSnapshot().levels).toEqual({ '/w': { entries: [], truncated: false } })
  })

  it('select and setShowHidden write their single facts', () => {
    const store = createProjectTreeStore().create()
    store.actions.select('/w/a.ts')
    expect(store.getSnapshot().selectedPath).toBe('/w/a.ts')
    store.actions.select(null)
    expect(store.getSnapshot().selectedPath).toBeNull()
    store.actions.setShowHidden(true)
    expect(store.getSnapshot().showHidden).toBe(true)
  })
})
