import { readFileSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const ZSTD_MAGIC = 0xFD2FB528
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`bad magic at ${offset}`)
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
const buf = readFileSync(root + '\\session-19ed7901-2b57-4cdf-94bb-9286e06f6331\\session.jsonl.zstd')
const { frames } = scanZstdFrames(buf)
let text = ''
for (const f of frames) text += zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8')
const lines = text.split('\n')
const out = []
for (const [i, line] of lines.entries()) {
  if (/seq":1019|seq":1020|seq":1021|seq":1022/.test(line) && line.includes('user/message')) {
    out.push(`LINE ${i + 1} (full user report):\n${line}\n`)
  }
}
// last 400 lines of the session: the agent's fix actions
out.push('=== TAIL (last 300 lines, compact) ===')
for (const line of lines.slice(-300)) {
  const t = line.slice(0, 220)
  out.push(t)
}
const report = out.join('\n')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\fix-attempt.txt', report, 'utf8')
console.log(report.slice(0, 9000))
