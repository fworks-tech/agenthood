/**
 * Activation predicates (#610): a skill can declare conditions that must hold
 * before it may load, so a CI-only or failing-tests-only skill stays out of the
 * way elsewhere.
 *
 * Deliberately tiny: four predicates, no expression language, no negation.
 * A skill that needs more than this is describing a workflow, not a condition.
 */

import { existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { execFileSync } from 'node:child_process'

export type ConditionResult = { ok: true } | { ok: false; reason: string }

const SUPPORTED = [
  'env:NAME=value: the variable equals value',
  'env:NAME: the variable is set',
  'file.exists:path: the path exists under the project root',
  'git.status:dirty|clean: the working tree has (no) uncommitted changes',
]

/**
 * Parse an expression into `predicate:argument`. Colons inside the argument are
 * allowed (`file.exists:src/a:b`), so only the first colon splits.
 */
export function parseCondition(expression: string): { predicate: string; argument: string } {
  const index = expression.indexOf(':')
  if (index <= 0) return { predicate: expression.trim(), argument: '' }
  return { predicate: expression.slice(0, index).trim(), argument: expression.slice(index + 1).trim() }
}

const PREDICATES = new Set(['env', 'file.exists', 'git.status'])

/** True for a supported predicate name: `verify` rejects the rest as typos. */
export function isKnownCondition(expression: string): boolean {
  return PREDICATES.has(parseCondition(expression).predicate)
}

/**
 * Evaluate one expression. Paths are resolved under `cwd` and must stay there:
 * a skill from another author must not probe `~/.ssh` by declaring it a
 * condition.
 */
export function evaluateCondition(expression: string, cwd: string): ConditionResult {
  const { predicate, argument } = parseCondition(expression)

  if (predicate === 'env') {
    const [name, ...expected] = argument.split('=')
    const actual = process.env[name]
    if (actual === undefined) return { ok: false, reason: `env ${name} is not set` }
    if (expected.length === 0) return { ok: true }
    const value = expected.join('=')
    return actual === value ? { ok: true } : { ok: false, reason: `env ${name} is "${actual}", expected "${value}"` }
  }

  if (predicate === 'file.exists') {
    if (!argument) return { ok: false, reason: 'file.exists needs a path' }
    const target = resolve(cwd, argument)
    const root = resolve(cwd)
    if (target !== root && !target.startsWith(root + sep)) {
      return { ok: false, reason: `file.exists path "${argument}" escapes the project root` }
    }
    return existsSync(target) ? { ok: true } : { ok: false, reason: `file ${argument} does not exist` }
  }

  if (predicate === 'git.status') {
    if (argument !== 'dirty' && argument !== 'clean') {
      return { ok: false, reason: 'git.status expects dirty or clean' }
    }
    let dirty: boolean
    try {
      dirty = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim().length > 0
    } catch {
      return { ok: false, reason: 'not a git repository' }
    }
    const wantsDirty = argument === 'dirty'
    return dirty === wantsDirty ? { ok: true } : { ok: false, reason: `git working tree is ${dirty ? 'dirty' : 'clean'}` }
  }

  return { ok: false, reason: `unknown condition "${expression}". Supported: ${SUPPORTED.join('; ')}` }
}

/** True when every declared condition holds. */
export function evaluateConditions(conditions: string[] | undefined, cwd: string): ConditionResult {
  for (const expression of conditions ?? []) {
    const result = evaluateCondition(expression, cwd)
    if (!result.ok) return result
  }
  return { ok: true }
}
