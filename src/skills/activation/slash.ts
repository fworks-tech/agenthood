/**
 * Explicit activation with `/skill-name` in the user message (#530, #585).
 *
 * `/name` force-activates a skill before the model sees the task; `/name off`
 * disables it for this run. Only a leading run of slash tokens is treated as
 * activation syntax: a `/` inside a sentence stays prose, and an unknown name is
 * left in place with a warning rather than silently swallowed.
 */

export interface SlashActivation {
  /** The task with the leading slash tokens removed. */
  task: string
  activate: string[]
  /** Skills the user turned off for this run. */
  deactivate: string[]
  /** Slash tokens that named nothing: stripped from the task and reported. */
  unknown: string[]
}

const SLASH_TOKEN = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+(off))?(?:\s|$)/i

export function parseSlashActivations(task: string, knownSkills: ReadonlySet<string>): SlashActivation {
  const activate: string[] = []
  const deactivate: string[] = []
  const unknown: string[] = []
  let rest = task.trimStart()

  while (rest.startsWith('/')) {
    const match = SLASH_TOKEN.exec(rest)
    if (!match) break
    const name = match[1]
    const off = match[2]?.toLowerCase() === 'off'

    if (!knownSkills.has(name)) {
      // Report it, but still strip it: a stray `/name` left in the task reads as
      // a path and derails the model more than the lost token does.
      unknown.push(name)
      rest = rest.slice(match[0].length)
      break
    }
    if (off) {
      if (!deactivate.includes(name)) deactivate.push(name)
    } else if (!activate.includes(name) && !deactivate.includes(name)) {
      activate.push(name)
    }
    rest = rest.slice(match[0].length)
  }

  return { task: rest.trimStart(), activate, deactivate, unknown }
}

export interface SlashOutcome {
  /** The task the model should see. */
  task: string
  /** Activated skill blocks, in the order the user asked for them. */
  explicitSkills: string[]
}

/**
 * Run the leading slash activations through the real tool, so budget,
 * conditions and fallback apply to an explicit request exactly as they do to a
 * model-driven one (#530).
 */
export async function applySlashActivations(
  task: string,
  knownSkills: ReadonlySet<string>,
  activate: (name: string) => Promise<{ success: boolean; output: string; error?: string } | undefined>,
): Promise<SlashOutcome> {
  const parsed = parseSlashActivations(task, knownSkills)
  const explicitSkills: string[] = []

  for (const name of parsed.unknown) {
    console.warn(`[skills] /${name} matches no discovered skill, ignored`)
  }
  for (const name of parsed.activate) {
    const result = await activate(name)
    if (result?.success) explicitSkills.push(result.output)
    else if (result) console.warn(`[skills] /${name}: ${result.error}`)
  }
  for (const name of parsed.deactivate) {
    console.warn(`[skills] /${name} off, the skill will not activate in this run`)
  }

  const changed = parsed.activate.length + parsed.deactivate.length + parsed.unknown.length > 0
  return { task: changed ? parsed.task || 'Follow the explicitly activated skill.' : task, explicitSkills }
}
