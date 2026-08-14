import { readFileSync } from 'node:fs'
import { validateSchema, SchemaValidationError } from '../core/SchemaValidator.js'
import type { JSONSchema } from '../llm/types.js'
import type { EvalSuite } from './types.js'

export const EVAL_SUITE_SCHEMA: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'tasks'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    baseline: { type: 'string' },
    metrics: {
      type: 'array',
      items: { type: 'string' },
    },
    tasks: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['input', 'expectedOutput'],
        properties: {
          input: { type: 'string', minLength: 1 },
          expectedOutput: { type: 'string', minLength: 1 },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
          },
        },
      },
    },
  },
} as JSONSchema

export function validateEvalSuite(data: unknown): void {
  validateSchema(data, EVAL_SUITE_SCHEMA)
}

/** Reads a suite file from disk and validates it, returning the typed suite. */
export function loadEvalSuite(filePath: string): EvalSuite {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    throw new SchemaValidationError(
      `cannot read eval suite "${filePath}": ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (err) {
    throw new SchemaValidationError(
      `eval suite "${filePath}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  validateEvalSuite(data)
  return data as EvalSuite
}
