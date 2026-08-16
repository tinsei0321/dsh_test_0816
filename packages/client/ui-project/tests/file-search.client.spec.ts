import { describe, expect, it } from 'vitest'
import { basenameOf, searchWorkspaceFiles, type ListTreeEntries } from '../src/client/file-search.ts'

interface Row { name: string; path: string; kind: 'file' | 'directory'; hidden: boolean }

const TREE: Record<string, Row[]> = {
  '/root': [
    { name: 'src', path: '/root/src', kind: 'directory', hidden: false },
    { name: 'guides', path: '/root/guides', kind: 'directory', hidden: false },
    { name: 'node_modules', path: '/root/node_modules', kind: 'directory', hidden: false },
    { name: 'package.json', path: '/root/package.json', kind: 'file', hidden: false },
  ],
  '/root/src': [
    { name: 'index.ts', path: '/root/src/index.ts', kind: 'file', hidden: false },
    { name: 'utils.ts', path: '/root/src/utils.ts', kind: 'file', hidden: false },
  ],
  '/root/guides': [
    { name: 'readme.md', path: '/root/guides/readme.md', kind: 'file', hidden: false },
  ],
  '/root/node_modules': [
    { name: 'foo', path: '/root/node_modules/foo', kind: 'directory', hidden: false },
  ],
  '/root/node_modules/foo': [
    { name: 'bar.ts', path: '/root/node_modules/foo/bar.ts', kind: 'file', hidden: false },
  ],
}

const listTreeEntries: ListTreeEntries = (path, _signal) => Promise.resolve({ entries: TREE[path] ?? [] })

describe('searchWorkspaceFiles', () => {
  it('finds files by name across the tree', async () => {
    const res = await searchWorkspaceFiles(listTreeEntries, '/root', 'readme', new AbortController().signal)
    expect(res.map(c => c.name)).toEqual(['/root/guides/readme.md'])
  })

  it('does not descend into skipped directories', async () => {
    const res = await searchWorkspaceFiles(listTreeEntries, '/root', 'bar', new AbortController().signal)
    expect(res).toEqual([])
  })

  it('surfaces directories as candidates when their own name matches', async () => {
    const res = await searchWorkspaceFiles(listTreeEntries, '/root', 'src', new AbortController().signal)
    expect(res.map(c => c.name)).toEqual(['/root/src'])
  })

  it('matches case-insensitively', async () => {
    const res = await searchWorkspaceFiles(listTreeEntries, '/root', 'README', new AbortController().signal)
    expect(res.map(c => c.name)).toEqual(['/root/guides/readme.md'])
  })

  it('skips an unreadable level instead of failing the walk', async () => {
    const throwing: ListTreeEntries = (path, _signal) => path === '/root/guides'
      ? Promise.reject(new Error('denied'))
      : Promise.resolve({ entries: TREE[path] ?? [] })
    const res = await searchWorkspaceFiles(throwing, '/root', 'readme', new AbortController().signal)
    expect(res).toEqual([])
  })
})

describe('basenameOf', () => {
  it('extracts the last segment across both separators', () => {
    expect(basenameOf('C:\\a\\b\\c.ts')).toBe('c.ts')
    expect(basenameOf('/a/b/c.ts')).toBe('c.ts')
    expect(basenameOf('c.ts')).toBe('c.ts')
  })
})
