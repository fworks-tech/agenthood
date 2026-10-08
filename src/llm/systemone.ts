/**
 * src/llm/systemone.ts
 *
 * Jev is a System One model from TypeSafe AI, served by OpenCode Zen on
 * `/v1/systemone`. It does NOT generate prose: given a `state` and a set of
 * typed questions it returns values + probabilities your code can act on
 * directly (yes/no `noul`, multiple-choice `choice`, rubric `score`).
 *
 * That contract is fundamentally different from `ILLMProvider` (text in, text
 * out), so Jev is deliberately NOT a drop-in provider — you cannot point a chat
 * turn at it. Its correct home in the Society is calibrated *decision*
 * confidence: the Mediator's intent routing, The Steward's complexity tiering,
 * The Doorman's entry-format checks — anywhere the current code is guessing and
 * would rather have a real probability. Every failure path returns `null` so a
 * caller always keeps its deterministic fallback and a Jev outage can never hang
 * a run.
 */

export type JevQuestion =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }

export interface JevAnswer {
  value: string | number | boolean
  /** Model-reported confidence, 0-1. */
  probability: number
}

export interface JevOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  signal?: AbortSignal
}

export const JEV_DEFAULT_MODEL = 'jev-1.13'

export async function decideWithJev(
  state: string,
  questions: Record<string, JevQuestion>,
  options: JevOptions = {},
): Promise<Record<string, JevAnswer> | null> {
  const apiKey = options.apiKey ?? process.env.OPENCODE_API_KEY
  if (!apiKey) return null
  const baseUrl = options.baseUrl ?? 'https://opencode.ai/zen/v1'
  try {
    const res = await fetch(`${baseUrl}/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: options.model ?? JEV_DEFAULT_MODEL, state, questions }),
      signal: options.signal,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { answers?: Record<string, JevAnswer> }
    return data.answers ?? null
  } catch {
    return null
  }
}

/** Convenience: single-choice decision over string options, clamped 0-100. */
export async function chooseWithJev(
  state: string,
  options: string[],
  opts: JevOptions & { instructions?: string } = {},
): Promise<{ value: string; probability: number } | null> {
  if (options.length === 0) return null
  const criteria: Record<string, string> = {}
  for (const o of options) criteria[o] = o
  const answers = await decideWithJev(
    state,
    {
      choice: {
        type: 'choice',
        instructions: opts.instructions ?? 'Select the best option for the given state.',
        criteria,
      },
    },
    opts,
  )
  const a = answers?.choice
  if (!a || typeof a.value !== 'string' || !options.includes(a.value)) return null
  return { value: a.value, probability: Math.round(Math.max(0, Math.min(1, a.probability)) * 100) }
}
