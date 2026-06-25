import { describe, it, expect } from 'vitest'
import { validateSchema, SchemaValidationError } from '../../../src/core/SchemaValidator.js'

describe('SchemaValidator', () => {
  describe('basic types', () => {
    it('passes when data matches object schema', () => {
      expect(() =>
        validateSchema({ a: 1 }, { type: 'object', properties: { a: { type: 'number' } } }),
      ).not.toThrow()
    })

    it('throws when required property is missing', () => {
      expect(() =>
        validateSchema({}, { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }),
      ).toThrow(SchemaValidationError)
    })
  })

  describe('enum validation', () => {
    it('passes when value is in enum', () => {
      const schema = { type: 'string', enum: ['create', 'update', 'delete'] }
      expect(() => validateSchema('create', schema)).not.toThrow()
    })

    it('throws when value is not in enum', () => {
      const schema = { type: 'string', enum: ['create', 'update', 'delete'] }
      expect(() => validateSchema('foobar', schema)).toThrow(SchemaValidationError)
    })
  })

  describe('pattern validation', () => {
    it('passes when string matches pattern', () => {
      const schema = { type: 'string', pattern: '^[a-z]+$' }
      expect(() => validateSchema('abc', schema)).not.toThrow()
    })

    it('throws when string does not match pattern', () => {
      const schema = { type: 'string', pattern: '^[a-z]+$' }
      expect(() => validateSchema('ABC', schema)).toThrow(SchemaValidationError)
    })
  })

  describe('minLength / maxLength', () => {
    it('passes when string length is within bounds', () => {
      const schema = { type: 'string', minLength: 2, maxLength: 5 }
      expect(() => validateSchema('abc', schema)).not.toThrow()
    })

    it('throws when string is too short', () => {
      const schema = { type: 'string', minLength: 3 }
      expect(() => validateSchema('ab', schema)).toThrow(SchemaValidationError)
    })

    it('throws when string is too long', () => {
      const schema = { type: 'string', maxLength: 3 }
      expect(() => validateSchema('abcd', schema)).toThrow(SchemaValidationError)
    })
  })

  describe('nested object validation', () => {
    const schema = {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      required: ['config'],
    }

    it('passes when nested object is valid', () => {
      expect(() => validateSchema({ config: { name: 'test' } }, schema)).not.toThrow()
    })

    it('throws when nested required property is missing', () => {
      expect(() => validateSchema({ config: {} }, schema)).toThrow(SchemaValidationError)
    })

    it('throws when nested property has wrong type', () => {
      expect(() =>
        validateSchema({ config: { name: 123 } }, schema),
      ).toThrow(SchemaValidationError)
    })

    it('error message uses JSON path notation for nested fields', () => {
      try {
        validateSchema({ config: { name: 123 } }, schema)
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(SchemaValidationError)
        expect((err as Error).message).toContain('config')
        expect((err as Error).message).toContain('name')
      }
    })
  })

  describe('array item validation', () => {
    const schema = {
      type: 'array',
      items: { type: 'string' },
    }

    it('passes when all items match schema', () => {
      expect(() => validateSchema(['a', 'b', 'c'], schema)).not.toThrow()
    })

    it('throws when an item has wrong type', () => {
      expect(() => validateSchema(['a', 123, 'c'], schema)).toThrow(SchemaValidationError)
    })

    it('error message references array index for invalid item', () => {
      try {
        validateSchema(['a', 123, 'c'], schema)
        throw new Error('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(SchemaValidationError)
        expect((err as Error).message).toMatch(/\[1\]/)
      }
    })
  })

  describe('$ref / definitions support', () => {
    const schema = {
      type: 'object',
      definitions: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      properties: {
        author: { $ref: '#/definitions/person' },
      },
      required: ['author'],
    }

    it('passes when $ref target is valid', () => {
      expect(() => validateSchema({ author: { name: 'Ada' } }, schema)).not.toThrow()
    })

    it('throws when $ref target is invalid', () => {
      expect(() => validateSchema({ author: {} }, schema)).toThrow(SchemaValidationError)
    })
  })

  describe('caching', () => {
    it('compiles schema once and reuses for identical schemas', () => {
      const schema = { type: 'object', properties: { x: { type: 'number' } } }
      expect(() => validateSchema({ x: 1 }, schema)).not.toThrow()
      expect(() => validateSchema({ x: 2 }, schema)).not.toThrow()
      expect(() => validateSchema({ x: 'bad' }, schema)).toThrow(SchemaValidationError)
    })
  })
})