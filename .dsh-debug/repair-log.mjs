import { readFileSync, writeFileSync, copyFileSync, renameSync, existsSync } from 'node:fs'
import { zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib'

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
    if ((descriptor & 0x18) !== 0) throw new Error(`reserved frame-header bit at ${offset - 1}`)
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
      if (blockType === 0x03) throw new Error(`reserved block type at ${offset - 3}`)
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

// Expand one storage row into (seq, time) pairs mirroring decodeStorageRecord.
function expandLine(line) {
  const value = JSON.parse(line)
  if (typeof value === 'object' && value !== null) {
    const tag = value.type
    if (tag === 'text-chunks' || tag === 'reasoning-chunks' || tag === 'tool-call-chunks') {
      const members = tag === 'tool-call-chunks' ? value.data.args : value.data.texts
      const out = []
      for (let k = 0; k < members.length; k++) out.push({ seq: value.seq0 + k })
      return out
    }
  }
  return [{ seq: value.seq }]
}

const dir = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--\\session-4b3586da-ecf8-4ade-b26d-dd8c8e84a8f9'
const cur = readFileSync(dir + '\\session.jsonl.zstd')
const { frames, tornStart } = scanZstdFrames(cur)
if (tornStart !== undefined) throw new Error('current file has a torn tail — abort')
if (frames.length !== 1) throw new Error(`expected exactly 1 frame, got ${frames.length}`)
const plain = zstdDecompressSync(cur.subarray(frames[0].start, frames[0].end)).toString('utf8')
if (!plain.endsWith('\n')) throw new Error('plaintext does not end with newline')
const lines = plain.split('\n')
lines.pop() // trailing empty after final \n

// 1. header check
const header = lines[0]
if (!/^\{"type":"session"/.test(header)) throw new Error('first line is not a session header')
console.log('header:', header.slice(0, 120))

// 2. seq continuity check over expanded rows
let expected = 0
let count = 0
let bad = null
for (let i = 1; i < lines.length; i++) {
  let rows
  try { rows = expandLine(lines[i]) } catch (e) { bad = `line ${i + 1}: ${e.message}`; break }
  for (const r of rows) {
    if (r.seq !== expected) { bad = `line ${i + 1}: expected seq ${expected}, got ${r.seq}`; break }
    expected += 1
    count += 1
  }
  if (bad) break
}
if (bad) throw new Error('seq check FAILED: ' + bad)
console.log(`seq check OK: ${count} events, contiguous 0..${count - 1}`)

// 3. re-frame: header frame + batched frames
const BATCH = 4000
const out = []
out.push(zstdCompressSync(Buffer.from(header + '\n'), { params: { [constants.ZSTD_c_checksumFlag]: 1 } }))
for (let i = 1; i < lines.length; i += BATCH) {
  const chunk = lines.slice(i, i + BATCH).join('\n') + '\n'
  out.push(zstdCompressSync(Buffer.from(chunk), { params: { [constants.ZSTD_c_checksumFlag]: 1 } }))
}
const repaired = Buffer.concat(out)
console.log(`re-framed: ${out.length} frames, ${repaired.length} bytes`)

// 4. self-verify: scan + first frame + full decode round-trip
const verify = scanZstdFrames(repaired)
if (verify.tornStart !== undefined) throw new Error('repaired file has torn tail')
const firstPlain = zstdDecompressSync(repaired.subarray(verify.frames[0].start, verify.frames[0].end))
if (firstPlain.length === 0 || firstPlain.indexOf(0x0A) !== firstPlain.length - 1) {
  throw new Error('repaired first frame is not exactly one header line')
}
let roundtrip = ''
for (const f of verify.frames) roundtrip += zstdDecompressSync(repaired.subarray(f.start, f.end)).toString('utf8')
if (roundtrip !== plain) throw new Error('round-trip mismatch')
console.log('self-verify OK: first frame is exactly one header line; round-trip identical')

// 5. publish: keep the bad single-frame file, keep original .bak, write repaired file
const target = dir + '\\session.jsonl.zstd'
if (!existsSync(dir + '\\session.jsonl.zstd.singleframe.bak')) {
  copyFileSync(target, dir + '\\session.jsonl.zstd.singleframe.bak')
  console.log('kept bad file as session.jsonl.zstd.singleframe.bak')
}
const tmp = target + '.repair.tmp'
writeFileSync(tmp, repaired)
const { unlinkSync } = await import('node:fs')
unlinkSync(target)
renameSync(tmp, target)
console.log('published repaired session.jsonl.zstd')
