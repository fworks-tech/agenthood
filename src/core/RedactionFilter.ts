import type { TraceEnvelope } from './types.ts'

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
 * Enabled by default with built-in rules; opt out via
 * `.agenthood/config.json` (`observability.redaction.enabled = false`).
 * Replacements use a deterministic placeholder so replay-based evaluation
 * keeps reproducible inputs.
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
    return this.options.enabled !== false
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
    const message = this.applyRules(envelope.message)
    const metadata = envelope.metadata ? this.redactMetadata(envelope.metadata) : undefined
    if (
      input === envelope.input
      && output === envelope.output
      && message === envelope.message
      && metadata === envelope.metadata
    ) return envelope
    return { ...envelope, input, output, message, metadata }
  }

  private redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const memo = new Map<object, unknown>()
    const out = this.redactValue(metadata, memo)
    return out === metadata ? metadata : (out as Record<string, unknown>)
  }

  private redactValue(value: unknown, memo: Map<object, unknown>): unknown {
    if (typeof value === 'string') return this.applyRules(value)
    if (typeof value !== 'object' || value === null) return value
    // non-plain values are preserved verbatim, never flattened: JSON already
    // serializes Date/RegExp/class instances; reconstructing them from
    // enumerable keys would silently drop their prototype and hidden state
    if (!isPlainObject(value) && !Array.isArray(value)) return value
    // memo (not a plain Set) so a shared reference appearing twice is
    // redacted once and both sites return the same result — a diamond must
    // not leak the unredacted original at its second occurrence. The
    // in-progress placeholder is the *output* object so a cycle's back
    // reference resolves to the redacted copy, not the plaintext original.
    const cached = memo.get(value)
    if (cached !== undefined) return cached

    if (Array.isArray(value)) {
      const out: unknown[] = []
      memo.set(value, out)
      let changed = false
      for (const item of value) {
        const next = this.redactValue(item, memo)
        if (next !== item) changed = true
        out.push(next)
      }
      const result = changed ? out : value
      memo.set(value, result)
      return result
    }

    const out: Record<string, unknown> = {}
    memo.set(value, out)
    let changed = false
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const next = this.redactValue(nested, memo)
      if (next !== nested) changed = true
      out[key] = next
    }
    // return the original object when nothing changed so callers can cheaply
    // detect "no redaction happened" instead of deep-comparing every entry
    const result = changed ? out : value
    memo.set(value, result)
    return result
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

/** True for objects whose prototype is Object.prototype or null (i.e. JSON-like). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
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
    enabled: r.enabled !== false,
    rules: Array.isArray(r.rules) ? r.rules.filter((x): x is string => typeof x === 'string') : undefined,
    paths: Array.isArray(r.paths) ? r.paths.filter((x): x is string => typeof x === 'string') : undefined,
  })
}
