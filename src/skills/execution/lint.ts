/**
 * Script interface lint (#540, #547, #548). These are warnings in `verify
 * --scripts`, not runtime refusals: static analysis cannot prove a shell script
 * never prompts. The runtime enforces what it can — closed stdin, a timeout,
 * and a non-zero exit surfaced as an error.
 */

export interface ScriptFinding {
  script: string
  rule: string
  message: string
}

export interface LintOptions {
  /** `output_format` declared by the owning skill. */
  outputFormat?: string
}

/** Templates the lint points at, so a fix names what to write. */
export const ERROR_TEMPLATES = {
  usage: 'usage: <script> [--help] [--dry-run] [options]',
  invalidInput: 'error: <value> is not valid for <option>. Expected <shape>. Try --help.',
  missingDependency: 'error: <tool> not found. Install it with <command>, then re-run.',
  dryRun: 'dry-run: would <action> <target>. Re-run without --dry-run to apply.',
  notFound: 'error: <path> not found. Check the path or run with --dry-run to inspect.',
} as const

const STDIN_PATTERNS = [
  /\binput\s*\(/,
  /process\.stdin/,
  /\breadline\b/,
  /read\s+-[a-z]*p\b/,
  /\bread\s+[A-Za-z_]$/m,
]
const REPL_MARKER = /isatty|--repl\b|--interactive\b/
const ARG_PARSER = /\bargv\b|\$1\b|getopts|sys\.argv/
/** These emit --help themselves, so a missing literal is not a finding. */
const AUTO_HELP = /argparse|ArgumentParser|\bclap\b|\bcommander\b/
const JSON_WRITER = /JSON\.stringify|json\.dumps|print\(json|to_json|jq\b/
const DESTRUCTIVE = /\brm\s+-[a-z]*r|shutil\.rmtree|git\s+reset\s+--hard|DROP\s+TABLE|fs\.rmSync\([^)]*recursive|Remove-Item\s+-Recurse/i
const EXIT_MESSAGE = /echo|console\.(?:error|log)|print\(|println!|eprintln!|Write-Output|logger\./
const EXIT_CODE = /\b(?:process\.)?exit\s*\(?\s*([0-9]{1,3})\b/g

export function lintScript(script: string, source: string, options: LintOptions = {}): ScriptFinding[] {
  const findings: ScriptFinding[] = []
  const add = (rule: string, message: string) => findings.push({ script, rule, message })

  if (STDIN_PATTERNS.some((re) => re.test(source)) && !REPL_MARKER.test(source)) {
    add('stdin', 'reads stdin, but an agent run has stdin closed — pass a value as an argument instead')
  }

  if (ARG_PARSER.test(source) && !AUTO_HELP.test(source) && !/--help\b/.test(source)) {
    add('help', 'declares arguments but has no --help output — the model cannot discover its interface')
  }

  if (options.outputFormat === 'json' && !JSON_WRITER.test(source)) {
    add('output', `skill declares output_format: json but the script does not emit JSON — ${ERROR_TEMPLATES.usage}`)
  }

  for (const match of source.matchAll(EXIT_CODE)) {
    const code = Number(match[1])
    if (code === 0 || code === 1 || code === 2) continue
    add('exit-code', `exit ${code} is outside the agreed 0=success, 1=error, 2=usage contract`)
  }

  if (DESTRUCTIVE.test(source) && !/--dry-run/.test(source)) {
    add('dry-run', `has a destructive branch but no --dry-run — ${ERROR_TEMPLATES.dryRun}`)
  }

  const lines = source.split('\n')
  lines.forEach((line, index) => {
    if (!/\bexit\s+1\b/.test(line) || EXIT_MESSAGE.test(line)) return
    const neighbours = lines.slice(Math.max(0, index - 2), index).join('\n')
    if (EXIT_MESSAGE.test(neighbours)) return
    add('error-message', `exit 1 with no message — ${ERROR_TEMPLATES.invalidInput}`)
  })

  return findings
}
