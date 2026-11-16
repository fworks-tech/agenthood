/**
 * Runtime selection for a bundled skill script (#546) and its inline
 * dependency story (#539). Extension first, shebang second — both are facts the
 * file states about itself, unlike a guess from its contents.
 */

export type ScriptLanguage = 'python' | 'javascript' | 'typescript' | 'bash'

export interface DetectedScript {
  language: ScriptLanguage
  /** Executable plus flags; the caller appends the script path and user args. */
  command: string[]
  /** Why this runtime — printed in the tool result header. */
  reason: string
}

export const SCRIPT_EXTENSIONS: Record<string, ScriptLanguage> = {
  '.py': 'python',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.sh': 'bash',
  '.bash': 'bash',
}

const PEP723_RE = /^#\s*\/\/\/\s*script\b/m
const NPM_IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)['"]npm:/

export function hasPep723Block(source: string): boolean {
  return PEP723_RE.test(source)
}

export function hasNpmImport(source: string): boolean {
  return NPM_IMPORT_RE.test(source)
}

function languageFromShebang(source: string): ScriptLanguage | undefined {
  const firstLine = source.split('\n', 1)[0] ?? ''
  if (!firstLine.startsWith('#!')) return undefined
  if (/\bpython[0-9.]*\b/.test(firstLine)) return 'python'
  if (/\bnode\b|\bdeno\b|\bbun\b/.test(firstLine)) return 'javascript'
  if (/\b(?:ba|da|z)?sh\b/.test(firstLine)) return 'bash'
  return undefined
}

/**
 * The runtime for a script, or undefined when the language is unsupported.
 * A missing runtime is the caller's error to report — this never falls back to
 * another language, because "ran with the wrong interpreter" is worse than
 * "did not run".
 */
export function detectScript(
  scriptPath: string,
  source: string,
  platform: NodeJS.Platform = process.platform,
): DetectedScript | undefined {
  const extension = scriptPath.slice(scriptPath.lastIndexOf('.')).toLowerCase()
  const language = SCRIPT_EXTENSIONS[extension] ?? languageFromShebang(source)

  switch (language) {
    case 'python':
      if (hasPep723Block(source)) {
        return { language, command: ['uv', 'run'], reason: 'PEP 723 dependency block' }
      }
      return {
        language,
        command: [platform === 'win32' ? 'python' : 'python3'],
        reason: 'python script, no PEP 723 block',
      }
    case 'typescript':
    case 'javascript':
      if (hasNpmImport(source)) {
        return { language, command: ['deno', 'run'], reason: 'npm: import, resolved by deno' }
      }
      return { language, command: ['node'], reason: `${language} script` }
    case 'bash':
      return { language, command: ['bash'], reason: 'shell script' }
    default:
      return undefined
  }
}
