import { execSync } from 'node:child_process'

// This regex is intentionally tight — all callers pass hardcoded strings.
// If user input is ever interpolated here, expand cautiously: missing chars
// like ? * would tempt unsafe loosening. Keep the surface small.
const ALLOWED_RE = /^[a-zA-Z0-9 @\-_./:%=,]+$/
const HAS_NEWLINE_RE = /[\n\r]/

export function safeExec(command: string, options?: { cwd?: string }): string {
  if (typeof command !== 'string' || !ALLOWED_RE.test(command) || HAS_NEWLINE_RE.test(command)) {
    throw new Error(`safeExec: rejected potentially unsafe command: ${command}`)
  }
  return execSync(command, { cwd: options?.cwd, stdio: 'pipe', encoding: 'utf8' }).trim()
}
