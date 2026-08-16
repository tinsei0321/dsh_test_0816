import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createZstdDecompress } from 'node:zlib'

const root = 'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--'
const needles = ['用量', 'usage', 'cordis_define', 'cordis_run', 'tool.view', 'pluginId', '用量插件']

function decompress(path) {
  const buf = readFileSync(path)
  const dec = createZstdDecompress()
  const parts = []
  dec.on('data', (c) => parts.push(c))
  const done = new Promise((res, rej) => {
    dec.on('end', res)
    dec.on('error', rej)
  })
  // feed in chunks so multi-frame files decode fully
  for (let i = 0; i < buf.length; i += 1 << 20) dec.write(buf.subarray(i, i + (1 << 20)))
  dec.end()
  return done.then(() => Buffer.concat(parts).toString('utf8'))
}

const out = []
for (const dir of readdirSync(root)) {
  const file = join(root, dir, 'session.jsonl.zstd')
  let text
  try {
    text = await decompress(file)
  } catch (err) {
    out.push(`== ${dir}: DECOMPRESS FAILED: ${err.message}`)
    continue
  }
  const lines = text.split('\n')
  const hits = []
  lines.forEach((line, i) => {
    for (const n of needles) {
      if (line.includes(n)) {
        hits.push(`${i + 1}: ${line.slice(0, 400)}`)
        break
      }
    }
  })
  out.push(`== ${dir}: ${lines.length} lines, ${hits.length} hit-lines`)
  out.push(...hits.slice(0, 60).map((h) => '   ' + h))
}
const report = out.join('\n')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\scan-report.txt', report, 'utf8')
console.log(report.slice(0, 6000))
