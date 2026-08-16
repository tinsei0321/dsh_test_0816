import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { zstdDecompressSync, createZstdDecompress } from 'node:zlib'

const root = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--'
for (const dir of readdirSync(root).sort()) {
  const file = join(root, dir, 'session.jsonl.zstd')
  let st = null
  try { st = statSync(file) } catch { continue }
  const buf = readFileSync(file)
  let syncSize = -1, streamSize = -1, streamErr = null
  try { syncSize = zstdDecompressSync(buf).length } catch (e) { /* single-frame only */ }
  try {
    const dec = createZstdDecompress()
    const parts = []
    dec.on('data', (c) => parts.push(c))
    const done = new Promise((res, rej) => { dec.on('end', res); dec.on('error', rej) })
    for (let i = 0; i < buf.length; i += 1 << 20) dec.write(buf.subarray(i, i + (1 << 20)))
    dec.end()
    await done
    streamSize = Buffer.concat(parts).length
  } catch (e) { streamErr = e.message }
  console.log(`${dir}\tcompressed=${st.size}\tmt=${st.mtime.toISOString()}\tsync=${syncSize}\tstream=${streamSize}${streamErr ? '\terr=' + streamErr : ''}`)
}
