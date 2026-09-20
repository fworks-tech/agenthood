export interface CliErrorOptions {
  fix?: string
  docs?: string
  exitCode?: 1 | 2
}

export function handleCliError(err: unknown, opts: CliErrorOptions = {}): never {
  const message = err instanceof Error ? err.message : String(err)
  const exitCode = opts.exitCode ?? 2

  let output = `Error: ${message}`
  if (opts.fix) output += `\n  Fix: ${opts.fix}`
  if (opts.docs) output += `\n  Docs: ${opts.docs}`

  console.error(output)
  process.exit(exitCode)
}

export function userError(message: string, opts: CliErrorOptions = {}): never {
  handleCliError(new Error(message), { ...opts, exitCode: 1 })
}

export function systemError(message: string, opts: CliErrorOptions = {}): never {
  handleCliError(new Error(message), { ...opts, exitCode: 2 })
}
