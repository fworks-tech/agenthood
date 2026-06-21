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

  it('configures exec plugin to generate release notes', () => {
    const releaserc = JSON.parse(readFileSync('.releaserc.json', 'utf8')) as {
      plugins: Array<string | [string, Record<string, unknown>]>
    }

    const execPlugin = releaserc.plugins.find((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin
      return pluginName === '@semantic-release/exec'
    }) as [string, { prepareCmd?: string }] | undefined

    expect(execPlugin).toBeDefined()
    expect(Array.isArray(execPlugin)).toBe(true)
    expect(execPlugin?.[1]?.prepareCmd).toContain('generate-release-notes.ts')
  })

  it('includes docs/release-notes.md in git assets', () => {
    const releaserc = JSON.parse(readFileSync('.releaserc.json', 'utf8')) as {
      plugins: Array<string | [string, Record<string, unknown>]>
    }

    const gitPlugin = releaserc.plugins.find((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin
      return pluginName === '@semantic-release/git'
    }) as [string, { assets?: string[] }] | undefined

    expect(gitPlugin).toBeDefined()
    expect(gitPlugin?.[1]?.assets).toContain('docs/release-notes.md')
  })

  it('uses OIDC trusted publisher for npm publish', () => {
    const workflow = readFileSync('.github/workflows/semantic-release.yml', 'utf8')
    expect(workflow).toContain('id-token: write')
    expect(workflow).toContain('provenance=true')
    expect(workflow).not.toContain('NODE_AUTH_TOKEN')
    expect(workflow).not.toContain('NPM_TOKEN')
  })
})
