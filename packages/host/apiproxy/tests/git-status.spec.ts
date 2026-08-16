type ExecFileCallback = (
  error: (Error & { code?: string | number }) | null,
  stdout: string,
  stderr: string,
) => void
type ExecFileOptions = {
  timeout: number
  maxBuffer: number
  windowsHide: boolean
  signal?: AbortSignal
}
type ExecFileMock = (
  command: string,
  args: readonly string[],
  options: ExecFileOptions,
  callback: ExecFileCallback,
) => void

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn<ExecFileMock>() }))

vi.mock('node:child_process', () => ({ execFile: execFileMock }))

import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decorationLetter, GIT_MAX_OUTPUT_BYTES, GIT_TIMEOUT_MS, parsePorcelainV1, runGitStatus,
} from '../src/git-status.ts'

beforeEach(() => {
  execFileMock.mockReset()
})

describe('decorationLetter', () => {
  it.each([
    ['modified index', 'M', ' ', 'M'],
    ['added index', 'A', ' ', 'A'],
    ['deleted index', 'D', ' ', 'D'],
    ['renamed index', 'R', ' ', 'R'],
    ['copied index', 'C', ' ', 'R'],
    ['typechange index', 'T', ' ', 'M'],
    ['modified worktree', ' ', 'M', 'M'],
    ['typechange worktree', ' ', 'T', 'M'],
    ['added worktree', ' ', 'A', 'A'],
    ['deleted worktree', ' ', 'D', 'D'],
    ['renamed worktree', ' ', 'R', 'R'],
    ['copied worktree', ' ', 'C', 'R'],
    ['untracked pair', '?', '?', 'U'],
    ['unmerged both', 'U', 'U', 'C'],
    ['unmerged index', 'U', 'D', 'C'],
    ['unmerged worktree', 'M', 'U', 'C'],
    ['worktree wins over index', 'M', 'D', 'D'],
    ['worktree wins over add', 'A', 'M', 'M'],
    ['clean pair', ' ', ' ', null],
    ['untracked half', '?', ' ', null],
    ['ignored pair', '!', '!', null],
  ])('%s (%s %s) → %s', (_label, x, y, expected) => {
    expect(decorationLetter(x, y)).toBe(expected)
  })
})

describe('parsePorcelainV1', () => {
  it('maps one record to an absolute path', () => {
    expect(parsePorcelainV1('M  file.txt\0', '/repo')).toEqual([
      { path: resolve('/repo', 'file.txt'), status: 'M' },
    ])
  })

  it('resolves nested forward-slash paths against the repo root', () => {
    expect(parsePorcelainV1('M  src/nested/deep.txt\0', '/repo')).toEqual([
      { path: resolve('/repo', 'src/nested/deep.txt'), status: 'M' },
    ])
  })

  it('consumes the old-path token of a rename record', () => {
    expect(parsePorcelainV1('R  new.txt\0old.txt\0', '/repo')).toEqual([
      { path: resolve('/repo', 'new.txt'), status: 'R' },
    ])
  })

  it('consumes the old-path token of a copy record', () => {
    expect(parsePorcelainV1('C  new.txt\0old.txt\0', '/repo')).toEqual([
      { path: resolve('/repo', 'new.txt'), status: 'R' },
    ])
  })

  it('consumes the old-path token of a worktree rename', () => {
    expect(parsePorcelainV1(' R new.txt\0old.txt\0', '/repo')).toEqual([
      { path: resolve('/repo', 'new.txt'), status: 'R' },
    ])
  })

  it('skips malformed tokens and undecorated records', () => {
    const output = [
      'M  a.txt',
      'bad',
      'M a.txt',
      '   clean.txt',
      '?? new.txt',
      '!! ignored.txt',
    ].join('\0')
    expect(parsePorcelainV1(`${output}\0`, '/repo')).toEqual([
      { path: resolve('/repo', 'a.txt'), status: 'M' },
      { path: resolve('/repo', 'new.txt'), status: 'U' },
    ])
  })

  it('returns no entries for empty output', () => {
    expect(parsePorcelainV1('', '/repo')).toEqual([])
  })
})

describe('runGitStatus', () => {
  it('runs rev-parse then status and parses the porcelain output', async () => {
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args.includes('rev-parse')) {
        callback(null, '/repo\n', '')
        return
      }
      callback(null, 'M  src/a.txt\0?? new.txt\0', '')
    })
    const signal = new AbortController().signal
    await expect(runGitStatus('/project', signal)).resolves.toEqual({
      root: '/repo',
      entries: [
        { path: resolve('/repo', 'src/a.txt'), status: 'M' },
        { path: resolve('/repo', 'new.txt'), status: 'U' },
      ],
    })
    expect(execFileMock.mock.calls.map(call => call[1])).toEqual([
      ['-C', '/project', 'rev-parse', '--show-toplevel'],
      ['-C', '/project', 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
    ])
  })

  it('forwards the fixed timeout, buffer bound, and windowsHide to execFile', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, '/repo\n', '')
    })
    const signal = new AbortController().signal
    await runGitStatus('/project', signal)
    const options = execFileMock.mock.calls[0]![2]
    expect(options).toEqual({
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_OUTPUT_BYTES,
      windowsHide: true,
      signal,
    })
  })

  it('runs without a caller signal', async () => {
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, '/repo\n', '')
    })
    await expect(runGitStatus('/project')).resolves.toEqual({ root: '/repo', entries: [] })
    const options = execFileMock.mock.calls[0]![2]
    expect(options).toEqual({
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_OUTPUT_BYTES,
      windowsHide: true,
    })
  })

  it('returns an empty listing when rev-parse fails (not a repository)', async () => {
    execFileMock.mockImplementationOnce((_command, _args, _options, callback) => {
      callback(Object.assign(new Error('not a git repository'), { code: 128 }), '', '')
    })
    await expect(runGitStatus('/project', new AbortController().signal))
      .resolves.toEqual({ root: '', entries: [] })
  })

  it('returns the repo root with no entries when status fails', async () => {
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args.includes('rev-parse')) {
        callback(null, '/repo\n', '')
        return
      }
      callback(Object.assign(new Error('git status failed'), { code: 1 }), '', '')
    })
    await expect(runGitStatus('/project', new AbortController().signal))
      .resolves.toEqual({ root: '/repo', entries: [] })
  })

  it('rethrows when rev-parse aborts', async () => {
    const abort = new AbortController()
    execFileMock.mockImplementationOnce((_command, _args, _options, callback) => {
      abort.abort(new Error('cancelled'))
      callback(Object.assign(new Error('aborted by signal'), { code: 'ABORT_ERR' }), '', '')
    })
    await expect(runGitStatus('/project', abort.signal)).rejects.toThrow('aborted by signal')
    expect(execFileMock).toHaveBeenCalledTimes(1)
  })

  it('rethrows when status aborts', async () => {
    const abort = new AbortController()
    execFileMock.mockImplementation((_command, args, _options, callback) => {
      if (args.includes('rev-parse')) {
        callback(null, '/repo\n', '')
        return
      }
      abort.abort(new Error('cancelled'))
      callback(Object.assign(new Error('aborted by signal'), { code: 'ABORT_ERR' }), '', '')
    })
    await expect(runGitStatus('/project', abort.signal)).rejects.toThrow('aborted by signal')
    expect(execFileMock).toHaveBeenCalledTimes(2)
  })
})
