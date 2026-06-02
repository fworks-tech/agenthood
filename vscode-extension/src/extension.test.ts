/**
 * Unit tests for Agenthood VS Code Extension
 *
 * Note: Full integration tests require VS Code extension testing framework.
 * These are basic unit tests for helper functions.
 */

import { describe, it, expect } from 'vitest';
import { AGENTHOOD_MEMBERS } from './members.js';

describe('AGENTHOOD_MEMBERS', () => {
  it('has correct length', () => {
    expect(AGENTHOOD_MEMBERS).toHaveLength(14);
  });

  it('contains expected members', () => {
    const expectedMembers = [
      'the-doorman',
      'the-scribe',
      'the-reviewer',
      'the-oracle',
      'the-steward',
    ];
    expectedMembers.forEach(member => {
      expect(AGENTHOOD_MEMBERS).toContain(member);
    });
  });

  it('member names follow naming convention', () => {
    AGENTHOOD_MEMBERS.forEach(member => {
      expect(member).toMatch(/^the-[a-z]+$/);
    });
  });
});
