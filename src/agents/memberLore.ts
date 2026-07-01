import { readFileSync, existsSync } from 'node:fs'

export function loadMemberLore(skillPath: string): string {
  if (!existsSync(skillPath)) return ''
  const content = readFileSync(skillPath, 'utf-8')
  return content.replace(/^---[\s\S]*?---\n*/, '').trim()
}
