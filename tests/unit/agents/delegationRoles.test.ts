import { describe, it, expect } from 'vitest'
import { DELEGATION_ALLOWED_ROLES } from '../../../src/agents/delegationRoles.ts'

const WRITE_CAPABLE_ROLES = ['architect', 'qa']

describe('DELEGATION_ALLOWED_ROLES', () => {
  it('excludes write-capable agents', () => {
    for (const role of WRITE_CAPABLE_ROLES) {
      expect(DELEGATION_ALLOWED_ROLES).not.toContain(role)
    }
  })

  it('contains only read-only analysis agents', () => {
    expect(DELEGATION_ALLOWED_ROLES).toEqual(['reviewer', 'the-oracle'])
  })
})