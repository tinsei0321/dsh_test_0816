import { readFileSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 0xFD2FB528
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error('bad magic')
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start }
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start }
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start }
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return { frames }
}

const root = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--'
const buf = readFileSync(root + '\\session-2a7fa015-47ca-465e-b0df-9d9bb325ad39\\session.jsonl.zstd')
const { frames } = scanZstdFrames(buf)
let text = ''
for (const f of frames) text += zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8')

const lines = text.split('\n')
const calls = []
for (const [i, line] of lines.entries()) {
  let m
  try { m = JSON.parse(line) } catch { continue }
  if (m.type === 'tool/call' && (m.data?.name === 'cordis_define' || m.data?.name === 'cordis_run' || m.data?.name === 'cordis_inspect_self')) {
    calls.push({ line: i + 1, name: m.data.name, args: m.data.arguments, time: m.data.time })
  }
}
console.log('total cordis tool calls:', calls.length)
// print compact list of define/run calls with pluginId/packageId/name/kind + code lengths
for (const c of calls) {
  try {
    const a = JSON.parse(c.args)
    if (c.name === 'cordis_define') {
      console.log(`L${c.line} ${c.name} kind=${a.plugin?.kind} idPrefix=${a.plugin?.idPrefix ?? ''} pluginId=${a.plugin?.pluginId ?? ''} name=${a.name} host=${a.code?.host?.length ?? 0} client=${a.code?.client?.length ?? 0}`)
    } else {
      console.log(`L${c.line} ${c.name} ${JSON.stringify(a).slice(0, 180)}`)
    }
  } catch { console.log(`L${c.line} ${c.name} (unparsable)`) }
}
// dump ALL cordis_define args raw (full) to a file for recovery
const dumps = calls.filter((c) => c.name === 'cordis_define').map((c) => `### line ${c.line}\n${c.args}`).join('\n\n')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\cordis-defines.jsonl.txt', dumps, 'utf8')
console.log('\nfull define args dumped to .dsh-debug/cordis-defines.jsonl.txt')
