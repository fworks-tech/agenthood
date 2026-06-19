import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class TemplateNotFoundError extends Error {
  constructor(templateName: string, available: string[]) {
    super(
      `Template not found: "${templateName}". Available templates: ${available.join(', ')}`
    )
    this.name = 'TemplateNotFoundError'
  }
}

export class PromptRegistry {
  private cache = new Map<string, string>()
  private templatesDir: string

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir ?? join(__dirname, 'templates')
  }

  get(name: string): string {
    const cached = this.cache.get(name)
    if (cached !== undefined) return cached

    const filePath = join(this.templatesDir, `${name}.md`)
    if (!existsSync(filePath)) {
      throw new TemplateNotFoundError(name, this.list())
    }

    const content = readFileSync(filePath, 'utf-8')
    this.cache.set(name, content)
    return content
  }

  list(): string[] {
    try {
      return readdirSync(this.templatesDir)
        .filter((f: string) => f.endsWith('.md'))
        .map((f: string) => f.replace(/\.md$/, ''))
    } catch {
      return []
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
