import { countTokens } from '../../core/modelPricing.ts'
import { DEFAULT_CONTEXT_WINDOW } from '../../llm/providers/constants.ts'

/** Share of the context window that skill bodies may occupy. */
export const SKILL_BUDGET_RATIO = 0.8

const PROCESS_HEADING = /^##\s+process\s*$/i
/** Level-2 heading — the section boundary. `###` is a subsection, not a boundary. */
const SECTION_HEADING = /^##\s+[^#]/
const ANY_HEADING = /^#{1,6}\s/
/** A step, as opposed to the prose elaborating it. */
const LIST_ITEM = /^\s*(\d+[.)]|[-*+])\s+/
const BOLD_LABEL = /^\*\*[^*]+\*\*:?\s*$/

const COMPRESSED_NOTICE =
  '<!-- skill-budget: ## Process reduced to headings and first lines. Re-read SKILL.md for the full steps. -->'

const STRIPPED_NOTICE =
  '<!-- skill-budget: ## Process dropped — the context budget is exhausted. Re-read SKILL.md before acting. -->'

const CLAMP_NOTICE =
  '<!-- skill-budget: body clamped to the remaining budget. Re-read SKILL.md before acting. -->'

function tidy(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Reduce `## Process` to its headings and the first line of each step.
 *
 * Everything outside `## Process` is kept verbatim: Overview, When to Use,
 * Red Flags, Rationalizations and Verification are what tell the model whether
 * the member applies and when to stop. `## Process` holds 60-84% of these
 * members' lines and is the part the model can re-read from disk.
 *
 * Inside Process the step skeleton survives — subsection headings, numbered and
 * bulleted steps, bold labels — and the prose wrapped around them does not.
 */
export function compressSkillBody(body: string): string {
  const out: string[] = []
  let inProcess = false

  for (const line of body.split('\n')) {
    if (SECTION_HEADING.test(line)) {
      inProcess = PROCESS_HEADING.test(line)
      out.push(line)
      if (inProcess) out.push('', COMPRESSED_NOTICE, '')
      continue
    }
    if (!inProcess) {
      out.push(line)
      continue
    }
    if (ANY_HEADING.test(line) || LIST_ITEM.test(line) || BOLD_LABEL.test(line)) {
      out.push(line)
    }
  }

  return tidy(out)
}

/**
 * Second degradation step: drop `## Process` outright.
 *
 * Slicing a compressed body to a byte budget cuts the tail, and the tail is
 * where Red Flags, Rationalizations and Verification live. Dropping Process
 * whole is what keeps the invariant that everything outside it survives.
 */
export function stripProcess(body: string): string {
  const out: string[] = []
  let inProcess = false

  for (const line of body.split('\n')) {
    if (SECTION_HEADING.test(line)) {
      inProcess = PROCESS_HEADING.test(line)
      if (inProcess) {
        out.push('', STRIPPED_NOTICE, '')
        continue
      }
    }
    if (!inProcess) out.push(line)
  }

  return tidy(out)
}

/**
 * Running token budget across the skill bodies injected into one run.
 *
 * A body already in the transcript cannot be shrunk afterwards, so the decision
 * has to happen at injection time: given what is already loaded, decide how much
 * of this body fits.
 *
 * ponytail: the total is per tool instance (per process), not per conversation.
 * Several agents sharing one process will under-use the window. Key it on a
 * conversation id if that ever matters.
 */
export class SkillBudget {
  private used = 0

  constructor(
    private readonly contextWindow: number = DEFAULT_CONTEXT_WINDOW,
    private readonly ratio: number = SKILL_BUDGET_RATIO,
  ) {}

  get limit(): number {
    return Math.floor(this.contextWindow * this.ratio)
  }

  get consumed(): number {
    return this.used
  }

  /** Squeeze `body` until it fits what is left of the budget. */
  fit(body: string): { body: string; compressed: boolean; savedTokens: number } {
    const full = countTokens(body)
    const remaining = this.limit - this.used

    if (full <= remaining) {
      this.used += full
      return { body, compressed: false, savedTokens: 0 }
    }

    let result = compressSkillBody(body)
    if (countTokens(result) > remaining) result = stripProcess(result)
    if (countTokens(result) > remaining) {
      result = this.clamp(result, remaining)
    }
    if (countTokens(result) > remaining) result = STRIPPED_NOTICE

    // The ceiling is a hard promise, so an exhausted budget clamps the counter
    // rather than letting the last body push the run past it.
    this.used = Math.min(this.limit, this.used + countTokens(result))
    return {
      body: result,
      compressed: true,
      savedTokens: full - countTokens(result),
    }
  }

  private clamp(body: string, tokens: number): string {
    const budget = Math.max(tokens, 0) * 4
    if (budget <= 0) return STRIPPED_NOTICE
    if (body.length <= budget) return body
    return `${body.slice(0, budget).trimEnd()}\n\n${CLAMP_NOTICE}`
  }
}
