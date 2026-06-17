import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('semantic release configuration', () => {
  it('configures npm plugin to publish from semantic-release', () => {
    const releaserc = JSON.parse(readFileSync('.releaserc.json', 'utf8')) as {
      plugins: Array<string | [string, Record<string, unknown>]>
    }

    const npmPlugin = releaserc.plugins.find((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin
      return pluginName === '@semantic-release/npm'
    }) as [string, { npmPublish?: boolean }] | undefined

    expect(npmPlugin).toBeDefined()
    expect(Array.isArray(npmPlugin)).toBe(true)
    expect(npmPlugin?.[1]?.npmPublish).toBe(true)
  })

  it('does not inject NPM_TOKEN as a top-level env var in release workflow', () => {
    const workflow = readFileSync('.github/workflows/semantic-release.yml', 'utf8')
    expect(workflow).not.toMatch(/^\s*NPM_TOKEN:/m)
  })

  it('uses OIDC trusted publisher for npm publish', () => {
    const workflow = readFileSync('.github/workflows/semantic-release.yml', 'utf8')
    expect(workflow).toContain('registry-url: https://registry.npmjs.org/')
    expect(workflow).toContain('id-token: write')
    expect(workflow).not.toContain('NODE_AUTH_TOKEN')
  })
})
