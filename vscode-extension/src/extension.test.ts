import assert from 'node:assert/strict';
import { AGENTHOOD_MEMBERS } from './members.js';

suite('AGENTHOOD_MEMBERS', () => {
  test('has correct length', () => {
    assert.equal(AGENTHOOD_MEMBERS.length, 14);
  });

  test('contains expected members', () => {
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

  test('member names follow naming convention', () => {
    AGENTHOOD_MEMBERS.forEach(member => {
      assert.match(member, /^the-[a-z]+$/);
    });
  });
});
