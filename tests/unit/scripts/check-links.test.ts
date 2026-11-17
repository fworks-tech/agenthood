import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error untyped mjs module
import { scan } from '../../../scripts/check-links.mjs'

const root = mkdtempSync(join(tmpdir(), 'check-links-'))
writeFileSync(join(root, 'target.md'), '# Target\n')
writeFileSync(join(root, 'image.png'), 'png')
mkdirSync(join(root, 'dir'))

describe('check-links.mjs', () => {
  it('reports a link to a missing file with its line number', () => {
    writeFileSync(join(root, 'missing.md'), 'intro\n[gone](nope.md)\n')
    const result = scan(['missing.md'], root)
    expect(result.broken).toEqual(['missing.md:2 -> nope.md'])
  })

  it('accepts a link to an existing file', () => {
    writeFileSync(join(root, 'valid.md'), '[ok](target.md)\n')
    expect(scan(['valid.md'], root).broken).toEqual([])
  })

  it('strips a fragment before resolving and ignores external schemes', () => {
    writeFileSync(join(root, 'anchors.md'), [
      '[section](target.md#intro)',
      '[pure](#intro)',
      '[web](https://example.com/a)',
      '[mail](mailto:a@b.c)',
      '[phone](tel:+123)',
    ].join('\n'))
    const result = scan(['anchors.md'], root)
    expect(result.broken).toEqual([])
    expect(result.links).toBe(1)
  })

  it('ignores links inside a fenced code block and inside inline code', () => {
    writeFileSync(join(root, 'fences.md'), [
      '```markdown',
      '[fake](absent.md)',
      '```',
      'Use `[example](also-absent.md)` here.',
    ].join('\n'))
    expect(scan(['fences.md'], root).broken).toEqual([])
    expect(scan(['fences.md'], root).links).toBe(0)
  })

  it('accepts a link to an existing directory', () => {
    writeFileSync(join(root, 'folder.md'), '[docs](dir)\n')
    expect(scan(['folder.md'], root).broken).toEqual([])
  })

  it('honours the per-line opt-out comment', () => {
    writeFileSync(join(root, 'optout.md'), [
      '[fake](absent.md) <!-- link-check-ignore -->',
      '[real](target.md)',
    ].join('\n'))
    const result = scan(['optout.md'], root)
    expect(result.broken).toEqual([])
    expect(result.links).toBe(1)
  })

  it('checks image targets and counts scanned files without generated ones', () => {
    writeFileSync(join(root, 'images.md'), '![alt](image.png)\n')
    const result = scan(['images.md', 'CHANGELOG.md', 'docs/release-notes.md'], root)
    expect(result.broken).toEqual([])
    expect(result.files).toBe(1)
    expect(result.links).toBe(1)
  })
})
