#!/usr/bin/env node
// Checks relative Markdown links against the files that actually exist.
// Generated files are skipped: their links come from release tooling, not prose.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const GENERATED = new Set(['CHANGELOG.md', 'docs/release-notes.md'])
const OPT_OUT = '<!-- link-check-ignore -->'
const EXTERNAL = /^(https?:\/\/|mailto:|tel:|#)/
const LINK = /!?\[[^\]]*\]\(([^)]+)\)/g
const FENCE = /^\s*(```|~~~)/

export function scan(files, root = process.cwd()) {
  const broken = []
  let links = 0
  let checked = 0
  for (const file of files) {
    if (GENERATED.has(file)) continue
    checked++
    let text
    try {
      text = readFileSync(resolve(root, file), 'utf8')
    } catch {
      continue
    }
    let fenced = false
    text.split(/\r?\n/).forEach((line, index) => {
      if (FENCE.test(line)) {
        fenced = !fenced
        return
      }
      if (fenced) return
      if (line.includes(OPT_OUT)) return
      const prose = line.replace(/`[^`]*`/g, '')
      for (const match of prose.matchAll(LINK)) {
        const target = match[1].trim().split(/\s+"/)[0]
        if (!target || EXTERNAL.test(target)) continue
        links++
        const path = target.split('#')[0]
        if (!path) continue
        const full = isAbsolute(path) ? path : resolve(root, dirname(file), path)
        if (!existsSync(full)) broken.push(`${file}:${index + 1} -> ${target}`)
      }
    })
  }
  return { files: checked, links, broken }
}

function main() {
  const root = process.cwd()
  const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8', cwd: root })
    .split('\n')
    .filter(Boolean)
  const { files: checked, links, broken } = scan(files, root)
  for (const line of broken) console.log(line)
  console.log(`checked ${checked} files, ${links} links, ${broken.length} broken`)
  process.exitCode = broken.length > 0 ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
