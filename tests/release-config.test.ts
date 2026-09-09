import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
})
