import { Ajv } from 'ajv'
import type { ValidateFunction } from 'ajv'
import type { JSONSchema } from '../llm/types.js'

const ajv = new Ajv({ allErrors: true })

const compiledCache = new Map<string, ValidateFunction>()

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
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
    const msgs = (validate.errors ?? []).map(e =>
      e.instancePath
        ? `"${e.instancePath.slice(1)}" ${e.message}`
        : e.message
    )
    if (msgs.length > 0) {
      throw new SchemaValidationError(msgs.join('; '))
    }
  }
}
