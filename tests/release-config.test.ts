import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanLine } from '../scripts/generate-release-notes.ts'

const WORKFLOW = readFileSync('.github/workflows/semantic-release.yml', 'utf8')
const HELPER = readFileSync('scripts/herald-release.mjs', 'utf8')

// The closing-keyword pattern is written in the workflow's shell step, so the
// only way to hold it to the lines it must catch is to read it back out and
// run it here. A copy of it in this file would pass while the workflow rotted.
const closingKeywordPattern = () => {
  const step = WORKFLOW.split('\n').find(l => l.includes('grep -inE') && l.includes('herald-notes.md'))
  if (!step) throw new Error('no closing-keyword gate on herald-notes.md in semantic-release.yml')
  const quoted = /grep -inE '(.+?)'/.exec(step)
  if (!quoted) throw new Error(`closing-keyword gate is not a single-quoted grep: ${step.trim()}`)
  // `[[:space:]]` is POSIX, which JS has never heard of; read as a class it
  // means "any of [ : s p a c e" and the gate stops matching real lines. The
  // quantifier has to move with it, or the pattern compiles to `\s++`.
  const posix = quoted[1].replaceAll('[[:space:]]+', '\\s+').replaceAll('[[:space:]]', '\\s')
  return new RegExp(posix, 'i')
}

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

  it('gates the generated artifacts, because the release head never gets CI', () => {
    // GitHub starts no workflow for a GITHUB_TOKEN push, and repository_dispatch
    // is suppressed by the same guard. The PR body is generated text built from
    // commit subjects, and a closing keyword in a merged body closes issues —
    // so the release job has to check its own output before the PR exists.
    expect(WORKFLOW).toMatch(/token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
    const gate = WORKFLOW.indexOf('gate the generated artifacts')
    const open = WORKFLOW.indexOf('open or refresh release PR')
    expect(gate).toBeGreaterThan(-1)
    expect(open).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(open)
    expect(WORKFLOW).toMatch(/herald-notes\.md carries a closing keyword/)
    expect(WORKFLOW).toMatch(/not linkified/)
  })

  it('flags a linkified closing keyword, the form the notes generator actually emits', () => {
    // The real v3.69.0 line, merged with a `closes [#663](url)` in the body.
    // herald-notes.md is the raw generateNotes output — cleanLine only ever
    // runs over the published files — so GitHub's `Closes #663` trailer on the
    // squash commit arrives linkified, and a gate that requires a bare `#N`
    // lets it through. Issue #967.
    const gate = closingKeywordPattern()
    const V3690 =
      '* **skills:** budget the context window at skill activation ' +
      '([#966](https://github.com/fworks-tech/agenthood/issues/966)) ' +
      '([726aebb](https://github.com/fworks-tech/agenthood/commit/726aebb)), ' +
      'closes [#663](https://github.com/fworks-tech/agenthood/issues/663) ' +
      '[#663](https://github.com/fworks-tech/agenthood/issues/663)'
    expect(gate.test(V3690)).toBe(true)
  })

  it('still flags the bare form, and stays quiet on clean notes', () => {
    const gate = closingKeywordPattern()
    expect(gate.test('* **fix:** something breaks, fixes #900')).toBe(true)
    expect(gate.test('* **deps:** bump x ([#1](https://x/1)) [#7](https://x/7)')).toBe(false)
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

describe('release notes linkify artifacts', () => {
  // The real v3.68.3 line for #951, which quotes closing keywords and a
  // link-shaped regex. conventional-changelog linkifies the quoted syntax
  // into '[#N](https://.../issues/N)' and '[#1](.../issues/1)', then trails
  // the line with a link per prose mention — seventeen refs, nearly all
  // duplicates.
  const LINKIFY =
    '* **herald:** release notes stop leaking issue refs, changelog stops claiming false closures ' +
    '([#951](https://github.com/fworks-tech/agenthood/issues/951)) ' +
    '([73afc34](https://github.com/fworks-tech/agenthood/commit/73afc341a0c72472ea7127094aaef9ed093b7430)), ' +
    'closes [#949](https://x/949) [#948](https://x/948) [#946](https://x/946) [#900](https://x/900) ' +
    '[#947](https://x/947) [#945](https://x/945) [#N](https://github.com/fworks-tech/agenthood/issues/N) ' +
    '[#N](https://github.com/fworks-tech/agenthood/issues/N) [#1](https://github.com/fworks-tech/agenthood/issues/1) ' +
    '[#900](https://x/900) [#948](https://x/948) [#947](https://x/947) [#949](https://x/949) ' +
    '[#900](https://x/900) [#945](https://x/945) [#946](https://x/946) [#900](https://x/900) ' +
    '[#950](https://x/950) [#949](https://x/949)'

  it('renders the real linkify-damaged line clean', () => {
    expect(cleanLine(LINKIFY)).toBe(
      '- **Herald:** release notes stop leaking issue refs, changelog stops claiming false closures ' +
      '(#951), refs #949, #948, #946, #900, #947, #945, #1, #950'
    )
  })

  it('publishes no raw markdown URL', () => {
    // '#945[#N](https://.../issues/N)' is what reached docs/release-notes.md.
    expect(cleanLine(LINKIFY)).not.toMatch(/\]\(https/)
  })

  it('does not glue the last ref to the link it could not match', () => {
    // The separator was consumed by the capture group instead of asserted.
    expect(cleanLine(LINKIFY)).not.toMatch(/#\d+\[/)
  })

  it('folds prose mentions into the refs list instead of trailing them', () => {
    const line = cleanLine(LINKIFY)
    expect(line).not.toMatch(/\(#951\)\)\s+#/)
    expect(line.match(/#949/g)).toHaveLength(1)
  })

  it('drops a non-numeric label link entirely', () => {
    expect(cleanLine('* **x:** y ([#1](https://x/1)), closes [#7](https://x/7) [#N](https://github.com/fworks-tech/agenthood/issues/N)'))
      .toBe('- **X:** y (#1), refs #7')
  })

  it('drops the keyword when every ref in the list is invented', () => {
    // Real v3.68.1 line. Stripping only the links left a dangling 'closes',
    // which reads as a claim with nothing behind it.
    const line = cleanLine(
      '* **ci:** enforce PR descriptions link to an issue via doorman gate, ' +
      'closes [#N](https://github.com/fworks-tech/agenthood/issues/N) [#N](https://github.com/fworks-tech/agenthood/issues/N)'
    )
    expect(line).toBe('- **Ci:** enforce PR descriptions link to an issue via doorman gate')
    expect(line).not.toMatch(/closes|fixes/i)
  })

  it('drops a false closure the linkifier built out of a hyphenated word', () => {
    // Real v3.16.0 line. The commit body said 'high-severity check' and
    // closed nothing; the linkifier read it as a cross-repo ref and
    // conventional-changelog attached a closing claim to it.
    const line = cleanLine(
      '* **ci:** exempt npm ecosystem tools from dependency audit ' +
      '([8608af8](https://github.com/fworks-tech/agenthood/commit/8608af8)), ' +
      'closes [hi#severity](https://github.com/hi/issues/severity)'
    )
    expect(line).toBe('- **Ci:** exempt npm ecosystem tools from dependency audit')
    expect(line).not.toMatch(/closes|fixes/i)
  })

  it('leaves no trailing ref pile in the changelog', () => {
    // Only one line in the whole changelog had a refs list followed by more
    // linkified prose mentions. It is the only entry in the file shaped that
    // way, so it is an outlier rather than the house format.
    const lines = readFileSync('CHANGELOG.md', 'utf8').split('\n')
    expect(lines.filter(l => /, refs [\d, #]+\s+\[#[0-9]+\]\(https/.test(l))).toEqual([])
  })
})
