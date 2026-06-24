#!/usr/bin/env tsx
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs'
import { join, dirname, relative, basename, extname, sep, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked, Renderer } from 'marked'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC_DIRS = ['docs/academy', 'docs/adr']
const OUT_DIR = join(ROOT, 'site')
const GITHUB_BLOB = 'https://github.com/fworks-tech/agenthood/blob/main'

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...walk(full))
    } else if (extname(full) === '.md') {
      files.push(full)
    }
  }
  return files
}

const CSS = `
body {
  max-width: 42rem; margin: 2rem auto; padding: 0 1rem 4rem;
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.75; color: #f4f4f5; background: #09090b; font-size: 1rem;
}
h1, h2, h3 { line-height: 1.3; margin-top: 2rem; color: #ffffff; }
h1 { font-size: 1.75rem; border-bottom: 2px solid #27272a; padding-bottom: .5rem; }
h2 { font-size: 1.35rem; }
h3 { font-size: 1.1rem; }
a { color: #a78bfa; }
a:hover { text-decoration: underline; }
pre, code { font-size: .9em; background: #18181b; border-radius: 6px; }
code { padding: .15em .3em; border: 1px solid #27272a; }
pre { padding: 1rem; overflow-x: auto; border: 1px solid #27272a; }
pre code { background: none; padding: 0; border: none; }
blockquote {
  margin: 1rem 0; padding: .5rem 1rem;
  border-left: 4px solid #a78bfa; background: #18181b;
}
table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
th, td { border: 1px solid #27272a; padding: .5rem; text-align: left; }
th { background: #18181b; font-weight: 600; }
ol, ul { padding-left: 1.5rem; }
li { margin: .25rem 0; }
hr { border: none; border-top: 1px solid #27272a; margin: 2rem 0; }
main { min-height: 60vh; }
`

function htmlTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Agenthood Academy</title>
<style>${CSS}</style>
</head>
<body>
<main>${body}</main>
</body>
</html>`
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function rewriteLink(href: string, fileDir: string, sourceIsIndex: boolean): string {
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
    return href
  }

  const [pathPart, anchor] = href.split('#')

  const sourceDir = join(ROOT, 'docs', fileDir)
  const targetAbs = resolve(sourceDir, pathPart)
  const relToDocs = relative(join(ROOT, 'docs'), targetAbs).split(sep).join('/')
  const fromFile = relative(sourceDir, targetAbs).split(sep).join('/')

  if (!relToDocs.startsWith('..') && pathPart.endsWith('.md')) {
    const parts = fromFile.split('/')
    const filename = parts.pop()!
    const isIndex = filename === 'README.md' || filename === 'index.md'
    const depthPrefix = sourceIsIndex ? '' : '../'
    let newPath: string
    if (isIndex) {
      newPath = depthPrefix + parts.join('/') + '/'
    } else {
      newPath = depthPrefix + [...parts, filename.replace('.md', '')].join('/') + '/'
    }
    return anchor ? newPath + '#' + anchor : newPath
  }

  const ghPath = relative(ROOT, targetAbs).split(sep).join('/')
  return GITHUB_BLOB + '/' + ghPath + (anchor ? '#' + anchor : '')
}

function convertMarkdown(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8')

  const relPath = relative(join(ROOT, 'docs'), filePath)
  const dir = dirname(relPath)
  const fileDir = dir.split(sep).join('/')
  const name = basename(filePath, '.md')
  const isIndex = name === 'README' || name === 'index'

  const renderer = new Renderer()
  renderer.link = function ({ href, title, text }) {
    const rewritten = rewriteLink(href, fileDir, isIndex)
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${rewritten}"${titleAttr}>${text}</a>`
  }

  const html = marked.parse(content, { renderer, mangle: false, headerIds: true }) as string

  const title = content.split('\n')[0]?.replace(/^#\s*/, '') || 'Agenthood Academy'
  const outPath = isIndex
    ? join(OUT_DIR, dir, 'index.html')
    : join(OUT_DIR, dir, name, 'index.html')

  ensureDir(outPath)
  writeFileSync(outPath, htmlTemplate(title, html))
  console.log('  →', relative(OUT_DIR, outPath))
}

function build(): void {
  console.log('Building Academy site...\n')

  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true })

  const files = SRC_DIRS
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => !f.endsWith('ARTICLE_TEMPLATE.md'))

  for (const file of files) {
    convertMarkdown(file)
  }

  console.log('\nDone —', files.length, 'pages built to site/')
}

build()
