import type { JSONSchema } from '../llm/types.js'

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

/**
 * Validates data against a JSON Schema.
 * This is a basic implementation that covers common cases.
 * For production, consider using a library like Ajv.
 */
export function validateSchema(data: unknown, schema: JSONSchema): void {
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new SchemaValidationError(`Expected object, got ${typeof data}`)
    }

    const obj = data as Record<string, unknown>

    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in obj)) {
          throw new SchemaValidationError(`Missing required property: ${requiredProp}`)
        }
      }
    }

    // Validate each property if properties schema is defined
    if (schema.properties) {
      for (const [key, value] of Object.entries(obj)) {
        const propSchema = schema.properties[key]
        if (propSchema) {
          validateProperty(value, propSchema, key)
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      throw new SchemaValidationError(`Expected array, got ${typeof data}`)
    }
  } else if (schema.type === 'string') {
    if (typeof data !== 'string') {
      throw new SchemaValidationError(`Expected string, got ${typeof data}`)
    }
  } else if (schema.type === 'number') {
    if (typeof data !== 'number') {
      throw new SchemaValidationError(`Expected number, got ${typeof data}`)
    }
  } else if (schema.type === 'boolean') {
    if (typeof data !== 'boolean') {
      throw new SchemaValidationError(`Expected boolean, got ${typeof data}`)
    }
  }
}

function validateProperty(value: unknown, propSchema: any, propName: string): void {
  const expectedType = propSchema.type

  if (expectedType === 'string' && typeof value !== 'string') {
    throw new SchemaValidationError(`Property "${propName}" must be string, got ${typeof value}`)
  }
  if (expectedType === 'number' && typeof value !== 'number') {
    throw new SchemaValidationError(`Property "${propName}" must be number, got ${typeof value}`)
  }
  if (expectedType === 'boolean' && typeof value !== 'boolean') {
    throw new SchemaValidationError(`Property "${propName}" must be boolean, got ${typeof value}`)
  }
  if (expectedType === 'array' && !Array.isArray(value)) {
    throw new SchemaValidationError(`Property "${propName}" must be array, got ${typeof value}`)
  }
  if (expectedType === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    throw new SchemaValidationError(`Property "${propName}" must be object, got ${typeof value}`)
  }
}
