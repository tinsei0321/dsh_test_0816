/** Folder-status aggregation: ancestor tinting with VS Code's merge order. */
import { describe, expect, it } from 'vitest'
import type { GitStatusLetter } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveFolderStatuses, FOLDER_STATUS_PRIORITY, normalizePath } from '../src/client/folder-status.ts'

describe('normalizePath', () => {
  it('maps backslashes to forward slashes', () => {
    expect(normalizePath('D:\\Github\\repo\\src\\a.ts')).toBe('D:/Github/repo/src/a.ts')
    expect(normalizePath('/w/a.ts')).toBe('/w/a.ts')
  })
})

describe('deriveFolderStatuses', () => {
  it('aggregates onto every ancestor up to and including the root', () => {
    const folders = deriveFolderStatuses(
      { '/w/src/deep/a.ts': 'M' },
      '/w',
    )
    expect(folders).toEqual({ '/w/src': 'M', '/w/src/deep': 'M', '/w': 'M' })
  })

  it('keeps the highest-priority letter when siblings disagree (C > D > M > U > A > R)', () => {
    const entries: Record<string, GitStatusLetter> = {
      '/w/a.ts': 'U',
      '/w/b.ts': 'D',
      '/w/src/c.ts': 'M',
      '/w/src/d.ts': 'C',
      '/w/src/e.ts': 'A',
      '/w/src/f.ts': 'R',
    }
    const folders = deriveFolderStatuses(entries, '/w')
    expect(folders['/w']).toBe('C')
    expect(folders['/w/src']).toBe('C')
  })

  it('prefers the aggregate letter over a weaker one regardless of entry order', () => {
    const weakerFirst = deriveFolderStatuses({ '/w/a.ts': 'U', '/w/b.ts': 'M' }, '/w')
    const weakerLast = deriveFolderStatuses({ '/w/b.ts': 'M', '/w/a.ts': 'U' }, '/w')
    expect(weakerFirst['/w']).toBe('M')
    expect(weakerLast['/w']).toBe('M')
  })

  it('ignores paths outside the root', () => {
    const folders = deriveFolderStatuses({ '/other/x.ts': 'M', '/w/y.ts': 'U' }, '/w')
    expect(folders).toEqual({ '/w': 'U' })
  })

  it('handles a prefix sibling that only shares the root string', () => {
    const folders = deriveFolderStatuses({ '/w-other/x.ts': 'M' }, '/w')
    expect(folders).toEqual({})
  })

  it('aggregates nothing for an empty root or no entries', () => {
    expect(deriveFolderStatuses({ '/w/a.ts': 'M' }, '')).toEqual({})
    expect(deriveFolderStatuses({}, '/w')).toEqual({})
  })

  it('matches backslash host paths against a slash root', () => {
    const folders = deriveFolderStatuses(
      { 'D:\\repo\\pkg\\a.ts': 'U' },
      'D:/repo',
    )
    expect(folders).toEqual({ 'D:/repo/pkg': 'U', 'D:/repo': 'U' })
  })

  it('a decorated file directly at the root tints the root itself', () => {
    const folders = deriveFolderStatuses({ '/w/README.md': 'M' }, '/w')
    expect(folders).toEqual({ '/w': 'M' })
  })

  it('documents the merge order constant', () => {
    expect(FOLDER_STATUS_PRIORITY).toEqual(['C', 'D', 'M', 'U', 'A', 'R'])
  })
})
