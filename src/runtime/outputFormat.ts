import type { OutputFormatMode } from '../members/types.ts'

export class OutputFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OutputFormatError'
  }
}

export interface FormatValidationResult {
  valid: boolean
  message: string
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Tests output against a declared regex pattern. Pure: no side effects, no
 * throw on invalid regex — a bad pattern reports invalid with a message so the
 * caller can decide how to surface it.
 */
export function validateOutputFormat(output: string, pattern: string): FormatValidationResult {
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    return { valid: false, message: `output_format pattern is not a valid regex: "/${pattern}/"` }
  }
  if (re.test(output)) return { valid: true, message: '' }
  return {
    valid: false,
    message: `expected output matching /${pattern}/, got: "${truncate(output, 200)}"`,
  }
}

/** Applies the declared mode to a deviation: strict throws, lenient warns. */
export function reportFormatDeviation(message: string, mode: OutputFormatMode): never | void {
  if (mode === 'strict') throw new OutputFormatError(`output_format deviation (strict): ${message}`)
  console.warn(`  output_format deviation (lenient): ${message}`)
}
