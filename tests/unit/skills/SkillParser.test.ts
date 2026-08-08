import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SkillParser, MAX_SKILL_FILE_BYTES } from "../../../src/skills/discovery/SkillParser.ts"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

function writeSkill(dir: string, content: string): string {
  const file = join(dir, "SKILL.md")
  writeFileSync(file, content)
  return file
}

describe("SkillParser", () => {
  const parser = new SkillParser()
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "skill-parser-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe("parse()", () => {
    it("parses valid frontmatter with name and description", () => {
      const file = writeSkill(dir, "---\nname: test-skill\ndescription: A test skill\n---\nBody here.")
      const result = parser.parse(file)
      expect(result).toEqual({ name: "test-skill", description: "A test skill", body: "Body here." })
    })

    it("parses frontmatter with description", () => {
      const file = writeSkill(dir, "---\nname: test\ndescription: A test skill\n---\nBody.")
      const result = parser.parse(file)
      expect(result).toEqual({ name: "test", description: "A test skill", body: "Body." })
    })

    it("handles colons in values", () => {
      const file = writeSkill(dir, "---\nname: my:skill\ndescription: Uses: colons\n---\nBody.")
      const result = parser.parse(file)
      expect(result?.name).toBe("my:skill")
      expect(result?.description).toBe("Uses: colons")
    })

    it("skips empty lines and comments", () => {
      const file = writeSkill(dir, "---\nname: test\n# this is a comment\n\ndescription: desc\n---\nBody.")
      const result = parser.parse(file)
      expect(result?.name).toBe("test")
      expect(result?.description).toBe("desc")
    })

    it("returns null when no frontmatter delimiters", () => {
      const file = writeSkill(dir, "No frontmatter here.\nJust content.")
      expect(parser.parse(file)).toBeNull()
    })

    it("returns null when description is missing", () => {
      const file = writeSkill(dir, "---\nname: test\n---\nBody.")
      expect(parser.parse(file)).toBeNull()
    })

    it("extracts body after closing delimiter", () => {
      const file = writeSkill(dir, "---\nname: t\ndescription: d\n---\nFirst line.\nSecond line.")
      const result = parser.parse(file)
      expect(result?.body).toBe("First line.\nSecond line.")
    })

    it("uses file path as name when name field is absent", () => {
      const file = writeSkill(dir, "---\ndescription: has desc\n---\nBody.")
      const result = parser.parse(file)
      expect(result?.name).toBe(file)
    })

    it("coerces numeric values", () => {
      const file = writeSkill(dir, "---\nname: test\ndescription: d\npriority: 5\n---\nBody.")
      const result = parser.parse(file)
      expect(result).not.toBeNull()
    })

    it("handles trailing newline after closing delimiter", () => {
      const file = writeSkill(dir, "---\nname: test\ndescription: d\n---\n\nBody.")
      const result = parser.parse(file)
      expect(result?.body).toBe("Body.")
    })

    it("returns null for oversized files", () => {
      const file = writeSkill(dir, "x".repeat(MAX_SKILL_FILE_BYTES + 1))
      expect(parser.parse(file)).toBeNull()
    })

    it("accepts files at exactly the size limit", () => {
      const content = "---\nname: ok\ndescription: ok\n---\n" + "x".repeat(MAX_SKILL_FILE_BYTES - 40)
      const file = writeSkill(dir, content)
      expect(parser.parse(file)).not.toBeNull()
    })
  })
})
