import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanLine } from '../scripts/generate-release-notes.ts'

const WORKFLOW = readFileSync('.github/workflows/semantic-release.yml', 'utf8')
const HELPER = readFileSync('scripts/herald-release.mjs', 'utf8')

describe('release configuration (Herald release-PR flow)', () => {
  it('computes the next version from conventional commits via commit-analyzer', () => {
    expect(HELPER).toContain('@semantic-release/commit-analyzer')
    expect(HELPER).toContain('@semantic-release/release-notes-generator')
    expect(HELPER).toContain(`analyzeCommits`)
    expect(HELPER).toContain(`generateNotes`)
  })

  it('never pushes release artifacts directly to main', () => {
    // The ruleset rejection this test guards against: a plain
    // `git push ... HEAD:main` step anywhere in the release path.
    expect(WORKFLOW).not.toMatch(/git push[^\n]*HEAD:main/m)
    expect(HELPER).not.toMatch(/git[^\n]*push/m)
  })

  it('opens a chore(release) PR instead of committing the bump directly', () => {
    expect(WORKFLOW).toContain('peter-evans/create-pull-request')
    expect(WORKFLOW).toContain('chore/rele')
    expect(WORKFLOW).toMatch(/branch: chore\/rele/)
    expect(WORKFLOW).toMatch(/commit-message: "chore\(release\): v/)
  })

  it('publishes only when package.json is ahead of the latest tag', () => {
    expect(HELPER).toContain('isPending')
    expect(WORKFLOW).toMatch(/herald-release\.mjs pending/)
    expect(WORKFLOW).toMatch(/if: steps\.pending\.outputs\.state == 'true'/)
  })

  it('tags via the GitHub releases API, not git push', () => {
    expect(WORKFLOW).toContain('gh release create')
    expect(WORKFLOW).not.toMatch(/git push.*--tags/m)
  })

  it('uses OIDC trusted publisher for npm publish', () => {
    expect(WORKFLOW).toContain('id-token: write')
    expect(WORKFLOW).toContain('provenance=true')
    expect(WORKFLOW).not.toContain('NODE_AUTH_TOKEN')
    expect(WORKFLOW).not.toContain('NPM_TOKEN')
  })

  it('keeps the changelog + release-notes docs regeneration in the PR', () => {
    expect(HELPER).toContain('CHANGELOG.md')
    expect(HELPER).toContain('generate-release-notes.ts')
    expect(WORKFLOW).toContain('npm run build')
  })

  it('gitignores the herald notes scratch file so create-pull-request cannot commit it', () => {
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/^herald-notes\.md$/m)
  })
})

describe('release notes issue references', () => {
  // Real lines from published changelog entries. The v3.68.3 line is what
  // shipped in docs/release-notes.md as '... (#948) #946 #900 #900 #947
  // #900 #946 #946 #946'; the v3.68.2 line is the one that lost #927.
  const V3683 =
    '* **dependabot:** stop the minor-patch group from swallowing 0.x majors, and land the four safe bumps ' +
    '([#948](https://github.com/fworks-tech/agenthood/issues/948)) ' +
    '([9fe04e8](https://github.com/fworks-tech/agenthood/commit/9fe04e8daadf82b59a40a501764bf3d527f7b692)), ' +
    'closes [#945](https://x/945) [#946](https://x/946) [#900](https://x/900) [#900](https://x/900) [#947](https://x/947)'

  const V3682 =
    '* **test:** raise the vitest timeout to fix the class, not the symptom ' +
    '([#934](https://x/934)) ' +
    '([0080126](https://x/008012677762d1650e811630e9bc91499835ac88)), ' +
    'closes [#927](https://x/927) [#914](https://x/914)'

  it('keeps every referenced issue instead of leaking refs 2..N as bare #N', () => {
    // Exact match, not a substring: the bug appended ' #946 #900 #900 #947'
    // after the commit link, so anything looser would pass on the old regex.
    expect(cleanLine(V3683)).toBe(
      '- **Dependabot:** stop the minor-patch group from swallowing 0.x majors, ' +
      'and land the four safe bumps (#948), refs #945, #946, #900, #947'
    )
  })

  it('does not discard the first reference of the list', () => {
    // The old single-link regex ate 'closes [#927]' and dropped #927, an
    // issue that really was closed, from the published v3.68.2 notes.
    expect(cleanLine(V3682)).toBe(
      '- **Test:** raise the vitest timeout to fix the class, not the symptom ' +
      '(#934), refs #927, #914'
    )
  })

  it('dedupes issues cited more than once in the same list', () => {
    // #900 is cited twice in the real v3.68.3 line and must survive once.
    const line = cleanLine(V3683)
    expect(line.match(/#900/g)).toHaveLength(1)
  })

  it('never renders a closing claim, so a prose mention cannot look like a closure', () => {
    // conventional-changelog gives a bare '#900' in a commit body the same
    // 'close' action as 'Closes #900'. Issue #900 is the pending tree-sitter
    // grammar migration, and the v3.68.3 changelog claimed to close it.
    expect(cleanLine(V3683)).not.toMatch(/closes|fixes/i)
  })

  it('keeps a single-reference list working', () => {
    expect(cleanLine('* **deps:** bump x ([#1](https://x/1)), closes [#7](https://x/7)'))
      .toBe('- **Deps:** bump x (#1), refs #7')
  })

  it('adds no references to a line that has none', () => {
    expect(cleanLine('* **test:** no issues here ([#12](https://x/12))'))
      .toBe('- **Test:** no issues here (#12)')
  })

  it('does not write files when imported, so the module is testable', () => {
    // generate() rewrites CHANGELOG.md and docs/release-notes.md. Importing
    // must not run it, or collecting this suite would rewrite the repo.
    expect(readFileSync('docs/release-notes.md', 'utf8')).toBe(
      readFileSync('docs/release-notes.md', 'utf8')
    )
  })

  it('ships a changelog with no false closing claims', () => {
    const changelog = readFileSync('CHANGELOG.md', 'utf8')
    expect(changelog).not.toMatch(/,?\s*(?:closes?|fixes?)\s+\[#\d+\]/)
  })
})
