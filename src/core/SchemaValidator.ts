import { Ajv } from 'ajv'
import type { ValidateFunction, ErrorObject } from 'ajv'
import type { JSONSchema } from '../llm/types.js'

const ajv = new Ajv({ allErrors: true })

const compiledCache = new Map<string, ValidateFunction>()

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

function formatError(err: ErrorObject): string {
  const path = err.instancePath
    ? err.instancePath
        .replace(/^\//, '')
        .split('/')
        .map((segment) => {
          return /^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`
        })
        .join('')
        .replace(/^\./, '')
    : ''

  const location = path
  const detail = humanizeParams(err)

  if (location && detail) {
    return `"${location}" ${detail}`
  }
  if (location) {
    return `"${location}" ${err.message ?? 'invalid'}`
  }
  return detail || err.message || 'invalid'
}

function humanizeParams(err: ErrorObject): string {
  const params = err.params as Record<string, unknown> | undefined
  if (!params) return ''

  const message = err.message ?? 'invalid'

  if (err.keyword === 'enum' && Array.isArray(params.allowedValues)) {
    return `must be equal to one of the allowed values: ${params.allowedValues.join(', ')}`
  }
  if (err.keyword === 'pattern' && typeof params.pattern === 'string') {
    return `must match pattern ${params.pattern}`
  }
  if (err.keyword === 'minLength' && typeof params.limit === 'number') {
    return `must NOT have fewer than ${params.limit} characters`
  }
  if (err.keyword === 'maxLength' && typeof params.limit === 'number') {
    return `must NOT have more than ${params.limit} characters`
  }
  if (err.keyword === 'required' && typeof params.missingProperty === 'string') {
    return `must have required property "${params.missingProperty}"`
  }
  return message
}

export function validateSchema(data: unknown, schema: JSONSchema): void {
  const schemaKey = JSON.stringify(schema)
  let validate = compiledCache.get(schemaKey)

  if (!validate) {
    validate = ajv.compile(schema as object)
    compiledCache.set(schemaKey, validate)
  }

  const valid = validate(data)
  if (!valid) {
    const msgs = (validate.errors ?? []).map(formatError)
    if (msgs.length > 0) {
      throw new SchemaValidationError(msgs.join('; '))
    }
  }
}