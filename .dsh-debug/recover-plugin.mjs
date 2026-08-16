import { readFileSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 0xFD2FB528
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`invalid frame magic at byte ${offset}`)
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
function decodeAll(buf) {
  const { frames } = scanZstdFrames(buf)
  let out = ''
  for (const f of frames) out += zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8')
  return out
}

const root = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--'
const report = []
// 1. verify .bak structure of 4b3586da
const dir = root + '\\session-4b3586da-ecf8-4ade-b26d-dd8c8e84a8f9'
const bak = readFileSync(dir + '\\session.jsonl.zstd.bak')
const { frames, tornStart } = scanZstdFrames(bak)
const firstPlain = zstdDecompressSync(bak.subarray(frames[0].start, frames[0].end))
const firstOk = firstPlain.length > 0 && firstPlain.indexOf(0x0A) === firstPlain.length - 1
report.push(`4b3586da .bak: frames=${frames.length} tornStart=${tornStart ?? 'none'} firstFrameOk=${firstOk}`)

// 2. search 19ed7901 and 2a7fa015 for the usage plugin source
for (const id of ['session-19ed7901-2b57-4cdf-94bb-9286e06f6331', 'session-2a7fa015-47ca-465e-b0df-9d9bb325ad39']) {
  const buf = readFileSync(`${root}\\${id}\\session.jsonl.zstd`)
  const text = decodeAll(buf)
  const hits = []
  text.split('\n').forEach((line, i) => {
    if (/cordis_define|cordis_run|用量|usage-plugin|pluginId|idPrefix/.test(line)) hits.push(`${i + 1}: ${line.slice(0, 200)}`)
  })
  report.push(`\n${id}: ${hits.length} plugin-related lines`)
  report.push(...hits.slice(0, 40).map((h) => '  ' + h))
  // also find what repacked 4b3586da: search for mentions of 4b3586da / zstd / repack
  const repack = []
  text.split('\n').forEach((line, i) => {
    if (/4b3586da|single.?frame|repack|zstdCompress/.test(line)) repack.push(`${i + 1}: ${line.slice(0, 200)}`)
  })
  report.push(`  (repack-related lines: ${repack.length})`)
  report.push(...repack.slice(0, 25).map((h) => '    ' + h))
}
const out = report.join('\n')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\plugin-recovery.txt', out, 'utf8')
console.log(out.slice(0, 8000))
