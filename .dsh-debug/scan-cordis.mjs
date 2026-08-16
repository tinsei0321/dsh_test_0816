import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createZstdDecompress } from 'node:zlib'

const roots = [
  'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-dsh_test--',
  'C:\\Users\\Hi\\.dsh\\sessions\\--D-Github-emotion_map--',
]

function decompress(path) {
  const buf = readFileSync(path)
  const dec = createZstdDecompress()
  const parts = []
  dec.on('data', (c) => parts.push(c))
  const done = new Promise((res, rej) => {
    dec.on('end', res)
    dec.on('error', rej)
  })
  for (let i = 0; i < buf.length; i += 1 << 20) dec.write(buf.subarray(i, i + (1 << 20)))
  dec.end()
  return done.then(() => Buffer.concat(parts).toString('utf8'))
}

const out = []
for (const root of roots) {
  for (const dir of readdirSync(root)) {
    const file = join(root, dir, 'session.jsonl.zstd')
    let text
    try {
      text = await decompress(file)
    } catch (err) {
      out.push(`== ${root}\\${dir}: DECOMPRESS FAILED: ${err.message}`)
      continue
    }
    const lines = text.split('\n')
    const hits = []
    lines.forEach((line, i) => {
      if (/cordis_define|cordis_run|cordis_stop|cordis_undefine|用量|tool\.view|"name":"dsh\/cordis|pluginId|packageId/.test(line)) {
        hits.push(`${i + 1}: ${line.slice(0, 300)}`)
      }
    })
    out.push(`== ${root}\\${dir}: ${lines.length} lines, ${hits.length} cordis/plugin hits`)
    out.push(...hits.slice(0, 200).map((h) => '   ' + h))
  }
}
const report = out.join('\n')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\cordis-hits.txt', report, 'utf8')
console.log(report.slice(0, 8000))
