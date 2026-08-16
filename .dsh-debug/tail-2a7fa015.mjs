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
const out = []
// last 900 lines: keep user/message, assistant text blocks (block-end text), tool calls with file paths
for (const line of lines.slice(-900)) {
  let m
  try { m = JSON.parse(line) } catch { continue }
  if (m.type === 'user/message') {
    out.push(`USER: ${JSON.stringify(m.data?.content?.map((c) => c.text ?? '').join(' ')).slice(0, 300)}`)
  } else if (m.type === 'assistant/message') {
    for (const c of m.data?.message?.content ?? []) {
      if (c.type === 'text') out.push(`ASSISTANT: ${c.text.slice(0, 400)}`)
    }
  } else if (m.type === 'tool/call') {
    try {
      const a = JSON.parse(m.data.arguments ?? '{}')
      if (a.file_path) out.push(`TOOL ${m.data.name} -> ${a.file_path}`)
      else if (m.data.name === 'pwsh') out.push(`TOOL pwsh -> ${a.command?.slice(0, 200)}`)
    } catch { /* ignore */ }
  }
}
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\tail-2a7fa015.txt', out.join('\n'), 'utf8')
console.log(out.slice(-120).join('\n').slice(0, 9000))
