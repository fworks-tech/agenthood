export interface ParsedEvalArgs {
  member: string | undefined
  memberB: string | undefined
  suitePath: string | undefined
  baselinePath: string | undefined
  benchmarkPath: string | undefined
  triggersPath: string | undefined
  providers: string[]
  shouldUpdateBaseline: boolean
  shouldJson: boolean
  shouldReplay: boolean
  shouldSemantic: boolean
  shouldConvergence: boolean
  shouldHistory: boolean
  replayLimit: number
  helpRequested: boolean
}

export function printUsage(): void {
  console.error(`Usage: agenthood eval <member> --suite <path>
  --suite <path>        Eval suite file (see evals/benchmarks/)
  --baseline <path>     Baseline file (default .agenthood/baselines/<member>.json)
  --update-baseline     Store this run as the new baseline
  --benchmark <path>    Write a standardized benchmark.json summary
  --provider <name>     Override the config provider; repeat to compare across providers
  --triggers <path>     Score activation trigger rate from a query-set JSON (no suite)
  --semantic            With --triggers: also score the embedding/description surface (needs a key)
  --replay [--limit N]  Re-run stored traces and compare output drift (no suite)
  --convergence         Check convergence against run history
  --history             Print run history table for this member
  --ab <memberB>        Blind A/B comparison against a second member
  --json                Machine-readable JSON output
  --help                Show this help`)
}

const BOOLEAN_FLAGS: Record<string, 'shouldUpdateBaseline' | 'shouldJson' | 'shouldReplay' | 'shouldSemantic' | 'shouldConvergence' | 'shouldHistory'> = {
  '--json': 'shouldJson',
  '--replay': 'shouldReplay',
  '--update-baseline': 'shouldUpdateBaseline',
  '--semantic': 'shouldSemantic',
  '--convergence': 'shouldConvergence',
  '--history': 'shouldHistory',
}

export function failUsage(message: string): never {
  console.error(message)
  process.exit(1)
}

export function parseEvalArgs(args: string[]): ParsedEvalArgs {
  const positional: string[] = []
  const flags: ParsedEvalArgs = {
    member: undefined, memberB: undefined, suitePath: undefined, baselinePath: undefined, benchmarkPath: undefined, triggersPath: undefined, providers: [],
    shouldUpdateBaseline: false, shouldJson: false, shouldReplay: false, shouldSemantic: false, shouldConvergence: false,
    shouldHistory: false, replayLimit: 50, helpRequested: false,
  }

  for (let i = 0; i < args.length; i++) {
    const booleanFlag = BOOLEAN_FLAGS[args[i]]
    if (booleanFlag) {
      flags[booleanFlag] = true
      continue
    }
    switch (args[i]) {
      case '--suite':
        flags.suitePath = args[++i]
        break
      case '--triggers':
        flags.triggersPath = args[++i]
        break
      case '--baseline':
        flags.baselinePath = args[++i]
        break
      case '--benchmark':
        flags.benchmarkPath = args[++i]
        break
      case '--ab':
        flags.memberB = args[++i]
        break
      case '--provider':
        flags.providers.push(args[++i])
        break
      case '--limit':
        flags.replayLimit = parseReplayLimit(args[++i])
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

export function parseReplayLimit(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  // 0 would disable the limit (slice(-0) === slice(0), unbounded replay)
  if (Number.isNaN(parsed) || parsed <= 0) {
    failUsage('Invalid --limit value — expected a positive integer')
  }
  return parsed
}
