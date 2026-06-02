/**
 * Unit tests for Agenthood VS Code Extension
 *
 * Note: Full integration tests require VS Code extension testing framework.
 * These are basic unit tests for helper functions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AGENTHOOD_MEMBERS } from './members.js';

describe('AGENTHOOD_MEMBERS', () => {
  it('has correct length', () => {
    assert.equal(AGENTHOOD_MEMBERS.length, 14);
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
      assert.ok(AGENTHOOD_MEMBERS.includes(member), `missing member: ${member}`);
    });
  });

  it('member names follow naming convention', () => {
    AGENTHOOD_MEMBERS.forEach(member => {
      assert.match(member, /^the-[a-z]+$/);
    });
  });
});
