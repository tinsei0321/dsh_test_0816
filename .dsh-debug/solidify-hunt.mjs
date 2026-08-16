import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
function decodeAll(buf) {
  const { frames } = scanZstdFrames(buf)
  let out = ''
  for (const f of frames) out += zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8')
  return out
}

const root = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--'
const targets = ['session-2a7fa015-47ca-465e-b0df-9d9bb325ad39', 'session-19ed7901-2b57-4cdf-94bb-9286e06f6331', 'session-b71ad879-a580-4d91-b516-2fff8fe887fb']
const report = []
for (const id of targets) {
  const buf = readFileSync(join(root, id, 'session.jsonl.zstd'))
  const text = decodeAll(buf)
  const hits = []
  text.split('\n').forEach((line, i) => {
    if (/固化|正式版|固化成|static plugin|packages[/\\]client|dsh-client-usage|usage-panel|formal/.test(line)) {
      hits.push(`${i + 1}: ${line.slice(0, 260)}`)
    }
  })
  report.push(`== ${id}: ${hits.length} hits`)
  report.push(...hits.slice(0, 60).map((h) => '   ' + h))
}
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\solidify-hunt.txt', report.join('\n'), 'utf8')
console.log(report.join('\n').slice(0, 9000))
