import { readFileSync, writeFileSync } from 'node:fs'

const raw = readFileSync('D:\\Github\\dsh_test\\.dsh-debug\\cordis-defines.jsonl.txt', 'utf8')
const sections = raw.split(/^### line \d+$/m).filter((s) => s.trim().length > 0)
const last = JSON.parse(sections[sections.length - 1].trim())
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\v11-host.js', last.code.host, 'utf8')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\v11-client.js', last.code.client, 'utf8')
writeFileSync('D:\\Github\\dsh_test\\.dsh-debug\\v11-meta.json', JSON.stringify({ name: last.name, purpose: last.purpose, plugin: last.plugin }, null, 2), 'utf8')
console.log('written v11 files')
console.log('name:', last.name)
console.log('purpose:', last.purpose)
console.log('plugin:', JSON.stringify(last.plugin))
console.log('host len:', last.code.host.length, 'client len:', last.code.client.length)
