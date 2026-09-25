export type InjectionSeverity = 'block' | 'warn'

export interface InjectionFinding {
  pattern: string
  severity: InjectionSeverity
  excerpt: string
}

// Known-malicious instruction-override and extraction patterns. Matches are
// whole-phrase and case-insensitive; bare security vocabulary ("token",
// "override" as a noun) never matches alone.
const BLOCK_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'ignore-instructions', re: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i },
  { name: 'disregard-instructions', re: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i },
  { name: 'override-instructions', re: /override\s+(your|the\s+system|system)\s+instructions/i },
  { name: 'reveal-system-prompt', re: /reveal\s+(your\s+)?system\s+prompt/i },
  { name: 'exfiltrate', re: /exfiltrat\w*/i },
  { name: 'credential-exfil', re: /send\b[\s\S]{0,80}?(api[_-]?key|bearer\s+token|password|secret)\s+(to|via)\s+\S*https?:/i },
  { name: 'forget-context', re: /forget\s+(everything|all)\s+(you\s+know|above|before)/i },
]

// Suspicious role-manipulation phrasing — worth a warning, not a block.
const WARN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'pretend-role', re: /pretend\s+(you\s+are|to\s+be)/i },
  { name: 'roleplay-as', re: /role[\s-]?play(\s+as\s+\w+)?/i },
  { name: 'jailbreak', re: /jailbreak/i },
  { name: 'bypass-guardrail', re: /bypass\s+(safety|guardrail|restriction|filter)/i },
  { name: 'you-are-now', re: /you\s+are\s+now\s+(?!a\s+(member|part)\b)/i },
]

function excerptAround(content: string, index: number): string {
  const start = Math.max(0, index - 40)
  return content.slice(start, index + 80).replace(/\s+/g, ' ').trim().slice(0, 120)
}

// Scan SKILL.md content for prompt-injection patterns. Pure — never throws.
// Code fences are stripped first so documented examples of attacks (like this
// module's own test fixtures) don't self-report.
export function scanForInjections(content: string): InjectionFinding[] {
  const prose = content.replace(/```[\s\S]*?```/g, '')
  const findings: InjectionFinding[] = []
  for (const { name, re } of BLOCK_PATTERNS) {
    const match = re.exec(prose)
    if (match && match.index !== undefined) findings.push({ pattern: name, severity: 'block', excerpt: excerptAround(prose, match.index) })
  }
  for (const { name, re } of WARN_PATTERNS) {
    const match = re.exec(prose)
    if (match && match.index !== undefined) findings.push({ pattern: name, severity: 'warn', excerpt: excerptAround(prose, match.index) })
  }
  return findings
}
