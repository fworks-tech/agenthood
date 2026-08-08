import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { SkillDiscovery } from "../../../src/skills/discovery/SkillDiscovery.ts"
import { SkillParser, MAX_SKILL_FILE_BYTES } from "../../../src/skills/discovery/SkillParser.ts"

const { mockHome } = vi.hoisted(() => ({ mockHome: { current: require('node:os').homedir() } }))
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:os')>()),
  homedir: () => mockHome.current,
}))

const SKILL_MD = `---
name: demo-skill
description: A demo skill
---
# Demo
Body text here.
`

const INNER_SKILL_MD = `---
name: inner-skill
description: An inner skill
---
# Inner
Body text here.
`

describe("SkillDiscovery", () => {
  let tmpDir: string
  let projectDir: string
  let userHome: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skill-discovery-'))
    userHome = join(tmpDir, 'user-home')
    mkdirSync(userHome, { recursive: true })
    mockHome.current = userHome
    projectDir = join(tmpDir, 'project')
    mkdirSync(join(projectDir, '.agents', 'skills', 'demo-skill'), { recursive: true })
    mkdirSync(join(projectDir, '.agents', 'skills', 'nested', 'inner-skill'), { recursive: true })
    writeFileSync(join(projectDir, '.agents', 'skills', 'demo-skill', 'SKILL.md'), SKILL_MD)
    writeFileSync(join(projectDir, '.agents', 'skills', 'nested', 'inner-skill', 'SKILL.md'), INNER_SKILL_MD)
    mkdirSync(join(projectDir, '.agents', 'skills', 'demo-skill', 'references'), { recursive: true })
    writeFileSync(join(projectDir, '.agents', 'skills', 'demo-skill', 'references', 'ref.md'), 'ref')
  })

  afterEach(() => {
    mockHome.current = homedir()
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it("discovers skills in .agents/skills recursively", () => {
    const discovery = new SkillDiscovery(projectDir)
    const manifests = discovery.discover(projectDir)
    const names = manifests.map((m) => m.name).sort()
    expect(names).toEqual(["demo-skill", "inner-skill"])
  })

  it("includes references in resources", () => {
    const discovery = new SkillDiscovery(projectDir)
    const manifests = discovery.discover(projectDir)
    const demo = manifests.find((m) => m.name === "demo-skill")
    expect(demo?.resources).toContain("references/ref.md")
  })

  it("skips ignored directories", () => {
    mkdirSync(join(projectDir, '.agents', 'skills', 'node_modules', 'fake-skill'), { recursive: true })
    writeFileSync(join(projectDir, '.agents', 'skills', 'node_modules', 'fake-skill', 'SKILL.md'), SKILL_MD)
    const discovery = new SkillDiscovery(projectDir)
    const manifests = discovery.discover(projectDir)
    expect(manifests.map((m) => m.name)).not.toContain("fake-skill")
  })

  it("project skills shadow user skills with the same name", () => {
    const userSkills = join(userHome, '.agents', 'skills')
    mkdirSync(join(userSkills, 'demo-skill'), { recursive: true })
    writeFileSync(join(userSkills, 'demo-skill', 'SKILL.md'), SKILL_MD)

    const discovery = new SkillDiscovery(projectDir)
    const manifests = discovery.discover(projectDir)
    const demo = manifests.filter((m) => m.name === "demo-skill")
    expect(demo).toHaveLength(1)
  })

  it("get() lazily discovers when discover() was not called", () => {
    const discovery = new SkillDiscovery(projectDir)
    const manifest = discovery.get("demo-skill")
    expect(manifest?.name).toBe("demo-skill")
  })

  it("list() lazily discovers when discover() was not called", () => {
    const discovery = new SkillDiscovery(projectDir)
    const manifests = discovery.list()
    expect(manifests.length).toBeGreaterThan(0)
  })

  it("get() returns undefined for unknown skill", () => {
    const discovery = new SkillDiscovery(projectDir)
    expect(discovery.get("does-not-exist")).toBeUndefined()
  })

  it("warns when a directory cannot be read", () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rmSync(join(projectDir, '.agents', 'skills'), { recursive: true, force: true })
    writeFileSync(join(projectDir, '.agents', 'skills'), 'not a directory')

    try {
      const discovery = new SkillDiscovery(projectDir)
      discovery.discover(projectDir)
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it("parse() returns null for oversized SKILL.md", () => {
    const bigDir = join(projectDir, '.agents', 'skills', 'big-skill')
    mkdirSync(bigDir, { recursive: true })
    writeFileSync(join(bigDir, 'SKILL.md'), 'x'.repeat(MAX_SKILL_FILE_BYTES + 1))
    const discovery = new SkillDiscovery(projectDir)
    const manifests = discovery.discover(projectDir)
    expect(manifests.map((m) => m.name)).not.toContain("big-skill")
  })

  it("SkillParser.parse() rejects oversized files", () => {
    const file = join(tmpDir, 'big.md')
    writeFileSync(file, 'x'.repeat(MAX_SKILL_FILE_BYTES + 1))
    const parser = new SkillParser()
    expect(parser.parse(file)).toBeNull()
  })
})
