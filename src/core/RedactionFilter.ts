import type { TraceEnvelope } from './types.js'

export interface RedactionOptions {
  enabled?: boolean
  /** Custom regex sources applied as redaction rules, e.g. ["\\b[A-Z0-9]{12}\\b"] */
  rules?: string[]
  /** File-system roots whose absolute paths are redacted, e.g. ["/home/me", "C:\\\\Users\\\\me"] */
  paths?: string[]
}

interface Rule {
  regex: RegExp
  replace: string | ((match: string) => string)
}

const PLACEHOLDER = '[REDACTED]'

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const API_KEY_RE = /\bsk-[A-Za-z0-9_-]{8,}\b/g
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/g
const URL_QUERY_RE = /([?&][^=&\s]+=)[^&\s]+/g
const IPV4_RE = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g
// Requires "::" compression or four or more segments so times like 10:30:45 are not matched
const IPV6_RE =
  /\b[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}\b|\b[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){3,7}\b/g

const URL_QUERY_REPLACE = (match: string): string => {
  const eq = match.indexOf('=')
  return `${match.slice(0, eq + 1)}${PLACEHOLDER}`
}

/**
 * Strips PII and secrets from trace payload text before it is persisted.
 * Opt-in via `.agenthood/config.json`; replacements use a deterministic
 * placeholder so replay-based evaluation keeps reproducible inputs.
 */
export class RedactionFilter {
  private readonly rules: Rule[] = []

  constructor(private readonly options: RedactionOptions = {}) {
    this.rules = [
      { regex: EMAIL_RE, replace: PLACEHOLDER },
      { regex: API_KEY_RE, replace: PLACEHOLDER },
      { regex: BEARER_RE, replace: PLACEHOLDER },
      { regex: URL_QUERY_RE, replace: URL_QUERY_REPLACE },
      { regex: IPV4_RE, replace: PLACEHOLDER },
      { regex: IPV6_RE, replace: PLACEHOLDER },
    ]
    for (const source of options.rules ?? []) {
      try {
        this.rules.push({ regex: new RegExp(source, 'g'), replace: PLACEHOLDER })
      } catch {
        console.warn(`[redaction] invalid custom rule skipped: "${source}"`)
      }
    }
    for (const root of options.paths ?? []) {
      this.rules.push({ regex: new RegExp(`${escapeRegExp(root)}[/\\\\][^\\s"'<>|]+`, 'g'), replace: PLACEHOLDER })
    }
  }

  enabled(): boolean {
    return this.options.enabled === true
  }

  /** Redacts a single text payload; returns it untouched when disabled. */
  redactText(text: string): string {
    if (!this.enabled()) return text
    return this.applyRules(text) ?? text
  }

  redact(envelope: TraceEnvelope): TraceEnvelope {
    if (!this.enabled()) return envelope
    const input = this.applyRules(envelope.input)
    const output = this.applyRules(envelope.output)
    if (input === envelope.input && output === envelope.output) return envelope
    return { ...envelope, input, output }
  }

  private applyRules(text: string | undefined): string | undefined {
    if (text === undefined) return undefined
    let result = text
    for (const rule of this.rules) {
      // replace accepts a replacer function at runtime; the union type only
      // needs the string overload selected for typechecking (TS has no
      // overload that takes the full union)
      const replaced = result.replace(rule.regex, rule.replace as string)
      if (replaced !== result) {
        result = replaced
      }
    }
    return result
  }
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds a RedactionFilter from a parsed `.agenthood/config.json`
 * `observability.redaction` block. Returns undefined when the block is absent.
 */
export function createRedactionFilterFromConfig(raw: unknown): RedactionFilter | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const block = (raw as Record<string, unknown>).observability
  if (typeof block !== 'object' || block === null) return undefined
  const redaction = (block as Record<string, unknown>).redaction
  if (typeof redaction !== 'object' || redaction === null) return undefined
  const r = redaction as Record<string, unknown>
  return new RedactionFilter({
    enabled: r.enabled === true,
    rules: Array.isArray(r.rules) ? r.rules.filter((x): x is string => typeof x === 'string') : undefined,
    paths: Array.isArray(r.paths) ? r.paths.filter((x): x is string => typeof x === 'string') : undefined,
  })
}
