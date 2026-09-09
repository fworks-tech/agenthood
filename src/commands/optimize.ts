import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SchemaValidationError } from '../core/SchemaValidator.ts'
import { DescriptionOptimizer } from '../evals/descriptionOptimizer.ts'
import type { OptimizationResult } from '../evals/descriptionOptimizer.ts'
import { loadTriggerSet } from './evalTriggers.ts'
import { ApplicationContext } from '../runtime/ApplicationContext.ts'
import { loadConfigOrExit } from './config.ts'
import { rawSpecs } from '../members/member-specs.ts'
import type { CommandDescriptor } from './types.ts'

function printUsage(): void {
  console.error(`Usage: agenthood optimize <member> --triggers <path>
  --triggers <path>     Trigger query-set JSON (required)
  --apply               Write winning description to member-specs.ts
  --iterations N        Max optimization iterations (default 3)
  --variants N          Variants per iteration (default 3)
  --json                Machine-readable JSON output
  --help                Show this help`)
}

export const command: CommandDescriptor = {
  name: 'optimize',
  description: 'Optimize a member description for trigger accuracy using LLM-driven eval loop',
  handler: (args) => optimizeHandler(args),
}

interface ParsedOptimizeArgs {
  member: string | undefined
  triggersPath: string | undefined
  apply: boolean
  json: boolean
  iterations: number
  variants: number
  helpRequested: boolean
}

function parseOptimizeArgs(args: string[]): ParsedOptimizeArgs {
  const positional: string[] = []
  const flags: ParsedOptimizeArgs = {
    member: undefined,
    triggersPath: undefined,
    apply: false,
    json: false,
    iterations: 3,
    variants: 3,
    helpRequested: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--triggers':
        flags.triggersPath = args[++i]
        break
      case '--apply':
        flags.apply = true
        break
      case '--json':
        flags.json = true
        break
      case '--iterations':
        flags.iterations = Number.parseInt(args[++i], 10)
        break
      case '--variants':
        flags.variants = Number.parseInt(args[++i], 10)
        break
      case '--help':
      case '-h':
        printUsage()
        return { ...flags, helpRequested: true }
      default:
        positional.push(args[i])
    }
  }

  return { ...flags, member: positional[0] }
}

async function optimizeHandler(args: string[]): Promise<void> {
  const { member, triggersPath, apply, json, iterations, variants, helpRequested } = parseOptimizeArgs(args)
  if (helpRequested) return

  if (!member || !triggersPath) {
    printUsage()
    process.exit(1)
  }

  let triggerSet
  try {
    triggerSet = loadTriggerSet(triggersPath)
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      console.error(`Invalid trigger set: ${err.message}`)
      process.exit(2)
    }
    throw err
  }

  const config = await loadConfigOrExit()
  const app = await ApplicationContext.create(process.cwd(), config)

  const optimizer = new DescriptionOptimizer(app.llm, (text) => app.llm.embed(text), {
    maxIterations: iterations,
    variantsPerIteration: variants,
  })

  const result = await optimizer.optimize(member, triggerSet)

  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    printResult(result)
  }

  if (apply && result.improved) {
    applyDescription(result)
  }
}

function printResult(result: OptimizationResult): void {
  console.log(`\n  Description Optimization — ${result.member}`)
  console.log(`  Iterations: ${result.iterations} | Variants: ${result.variants.length}\n`)

  console.log(`  Original: "${result.originalDescription}"`)
  console.log(`    F1: ${result.originalMetrics.f1.toFixed(3)} | P: ${result.originalMetrics.precision.toFixed(3)} | R: ${result.originalMetrics.recall.toFixed(3)}`)

  console.log(`\n  Best:     "${result.bestDescription}"`)
  console.log(`    F1: ${result.bestMetrics.f1.toFixed(3)} | P: ${result.bestMetrics.precision.toFixed(3)} | R: ${result.bestMetrics.recall.toFixed(3)}`)

  if (result.improved) {
    const delta = result.bestMetrics.f1 - result.originalMetrics.f1
    console.log(`\n  Improved: +${delta.toFixed(3)} F1`)
  } else {
    console.log('\n  No improvement found.')
  }

  console.log()
}

function applyDescription(result: OptimizationResult): void {
  const spec = rawSpecs.find((s) => s.name === result.member)
  if (!spec) return
  spec.description = result.bestDescription

  const filePath = join(process.cwd(), 'src', 'members', 'member-specs.ts')
  const content = readFileSync(filePath, 'utf8')
  const escapedName = result.member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(name:\\s*'${escapedName}',\\s*\\n\\s*description:\\s*')[^']*(')`)
  const updated = content.replace(pattern, `$1${result.bestDescription.replace(/'/g, "\\'")}$2`)

  if (updated === content) {
    console.log('  Warning: could not locate description in member-specs.ts to update.\n')
    return
  }

  writeFileSync(filePath, updated, 'utf8')
  console.log(`  Description written to member-specs.ts.\n`)
}
