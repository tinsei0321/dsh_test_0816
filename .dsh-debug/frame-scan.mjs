import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync, zstdCompressSync, constants } from 'node:zlib'

const ZSTD_MAGIC = 0xFD2FB528

// Port of scanZstdFrames from packages/session/session-persistence-jsonl/src/zstd.ts
function scanZstdFrames(buffer, maxFrames = Infinity) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return { frames, tornStart: start }
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
      throw new Error(`invalid frame magic at byte ${offset}`)
    }
    offset += 4
    if (offset === buffer.length) return { frames, tornStart: start }
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) throw new Error(`reserved frame-header bit at byte ${offset - 1}`)
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
      if (blockType === 0x03) throw new Error(`reserved block type at byte ${offset - 3}`)
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
    if (frames.length === maxFrames) return { frames }
  }
  return { frames }
}

const roots = [
  'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--',
  'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-emotion_map--',
]
for (const root of roots) {
  for (const dir of readdirSync(root)) {
    const file = join(root, dir, 'session.jsonl.zstd')
    let buf
    try { buf = readFileSync(file) } catch { continue }
    let scan
    try {
      scan = scanZstdFrames(buf)
    } catch (e) {
      console.log(`${dir}: SCAN ERROR: ${e.message}`)
      continue
    }
    const first = scan.frames[0]
    let lines = 0, firstLine = '', decoded = -1, verdict = ''
    if (first) {
      try {
        const plain = zstdDecompressSync(buf.subarray(first.start, first.end))
        decoded = plain.length
        const text = plain.toString('utf8')
        lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
        firstLine = text.split('\n', 1)[0].slice(0, 160)
        const oneHeaderLine = plain.length > 0 && plain.indexOf(0x0A) === plain.length - 1
        verdict = oneHeaderLine ? 'OK (exactly one header line)' : 'BAD: first frame is not exactly one header line'
      } catch (e) {
        verdict = `DECODE ERROR: ${e.message}`
      }
    } else {
      verdict = scan.tornStart !== undefined ? `NO COMPLETE FRAME (torn at ${scan.tornStart})` : 'EMPTY'
    }
    console.log(`${dir}\n  bytes=${buf.length} frames=${scan.frames.length} firstDecoded=${decoded} firstLines=${lines}\n  ${verdict}\n  line1: ${firstLine}`)
  }
}
