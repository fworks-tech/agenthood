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

  describe("BOM and non-ASCII parsing (#563)", () => {
    const BOM = String.fromCharCode(0xfeff)

    it("strips a leading UTF-8 BOM so frontmatter still parses", () => {
      const file = writeSkill(dir, BOM + "---\nname: test-skill\ndescription: A test skill\n---\nBody.")
      expect(parser.parse(file)).toEqual({ name: "test-skill", description: "A test skill", body: "Body." })
    })

    it("strips the BOM in parseRaw (shared with verify)", () => {
      const { frontmatter } = parser.parseRaw(BOM + "---\nname: the-test\ndescription: d\n---\nBody.")
      expect(frontmatter?.name).toBe("the-test")
    })

    it("preserves non-ASCII name and description alongside a BOM", () => {
      const file = writeSkill(dir, BOM + "---\nname: café\ndescription: Ação ünïcode\n---\nCorpo.")
      const result = parser.parse(file)
      expect(result?.name).toBe("café")
      expect(result?.description).toBe("Ação ünïcode")
      expect(result?.body).toBe("Corpo.")
    })
  })

  describe("validateSpec()", () => {
    const rules = (errs: { rule: string }[]) => errs.map((e) => e.rule)

    it("passes a compliant skill", () => {
      expect(parser.validateSpec("valid-name", "does a thing", "valid-name")).toEqual([])
    })

    it("rejects uppercase names", () => {
      expect(rules(parser.validateSpec("PDF-Processing", "d", "PDF-Processing"))).toContain("name-format")
    })

    it("rejects leading hyphens", () => {
      expect(rules(parser.validateSpec("--foo", "d", "--foo"))).toContain("name-format")
    })

    it("rejects consecutive hyphens", () => {
      expect(rules(parser.validateSpec("a--b", "d", "a--b"))).toContain("name-format")
    })

    it("rejects names over 64 chars", () => {
      expect(rules(parser.validateSpec("a".repeat(65), "d", "a".repeat(65)))).toContain("name-length")
    })

    it("rejects descriptions over 1024 chars", () => {
      expect(rules(parser.validateSpec("x", "y".repeat(1025), "x"))).toContain("description-length")
    })

    it("rejects name that does not match the directory", () => {
      expect(rules(parser.validateSpec("valid-name", "d", "wrong-name"))).toContain("name-directory-match")
    })

    it("rejects a file not named SKILL.md", () => {
      expect(rules(parser.validateSpec("x", "d", "x", "skill.md"))).toContain("filename")
    })

    it("returns a concrete fix for each violation", () => {
      const errs = parser.validateSpec("Bad_Name", "", "other")
      for (const e of errs) expect(e.fix.length).toBeGreaterThan(0)
    })
  })
})
