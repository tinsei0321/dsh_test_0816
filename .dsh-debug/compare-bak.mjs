import { readFileSync } from 'node:fs'
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
    if ((descriptor & 0x18) !== 0) throw new Error(`reserved bit at ${offset - 1}`)
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
      if (blockType === 0x03) throw new Error(`reserved block type`)
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

const dir = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--\\session-4b3586da-ecf8-4ade-b26d-dd8c8e84a8f9'
const bak = readFileSync(dir + '\\session.jsonl.zstd.bak')
const bakText = decodeAll(bak)
console.log('=== .bak: frames decompressed, total chars', bakText.length, 'lines', bakText.split('\n').length)
const bakLines = bakText.split('\n').filter(Boolean)
console.log('--- .bak last 8 lines:')
for (const l of bakLines.slice(-8)) console.log(l.slice(0, 260))

const cur = readFileSync(dir + '\\session.jsonl.zstd')
const curText = decodeAll(cur)
console.log('\n=== current: chars', curText.length)
const curLines = curText.split('\n').filter(Boolean)
console.log('--- current last 10 lines:')
for (const l of curLines.slice(-10)) console.log(l.slice(0, 260))
console.log('--- current first 3 lines:')
for (const l of curLines.slice(0, 3)) console.log(l.slice(0, 200))
