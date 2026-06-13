import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('semantic release configuration', () => {
  it('enables npm publishing', () => {
    const releaserc = JSON.parse(readFileSync('.releaserc.json', 'utf8')) as {
      plugins: Array<string | [string, Record<string, unknown>]>
    }

    const npmPlugin = releaserc.plugins.find((plugin) =>
      Array.isArray(plugin) ? plugin[0] === '@semantic-release/npm' : plugin === '@semantic-release/npm',
    )

    expect(npmPlugin).toBeDefined()
  })

  it('does not inject NPM_TOKEN into release workflow', () => {
    const workflow = readFileSync('.github/workflows/semantic-release.yml', 'utf8')
    expect(workflow).not.toContain('NPM_TOKEN')
  })
})
