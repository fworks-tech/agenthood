import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AGENTHOOD_MEMBERS } from './members.js';
import { getMemberTriggers, getInstalledMembers, MemberItem } from './memberWatchProvider.js';

suite('MemberWatchProvider — pure helpers', () => {
  test('getMemberTriggers returns patterns for trigger-capable members', () => {
    const auditorPatterns = getMemberTriggers('the-auditor');
    assert.ok(auditorPatterns.length > 0, 'The Auditor should have trigger patterns');
    assert.ok(auditorPatterns.some((p) => p.test('package.json')));
  });

  test('getMemberTriggers returns empty array for passive members', () => {
    const stewardPatterns = getMemberTriggers('the-steward');
    assert.deepStrictEqual(stewardPatterns, []);
  });

  test('getMemberTriggers: the-reviewer triggers on .ts files', () => {
    const patterns = getMemberTriggers('the-reviewer');
    assert.ok(patterns.some((p) => p.test('src/foo.ts')));
  });

  test('getMemberTriggers: the-librarian triggers on .md files only', () => {
    const patterns = getMemberTriggers('the-librarian');
    assert.ok(patterns.some((p) => p.test('README.md')));
    assert.ok(!patterns.some((p) => p.test('src/foo.ts')));
  });

  test('getInstalledMembers reads config.json correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthood-test-'));
    const configDir = path.join(tmpDir, '.agenthood');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ members: ['the-scribe', 'the-reviewer'] }),
    );

    const installed = getInstalledMembers(tmpDir);
    assert.ok(installed.has('the-scribe'));
    assert.ok(installed.has('the-reviewer'));
    assert.ok(!installed.has('the-auditor'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('getInstalledMembers returns empty set when config not found', () => {
    const installed = getInstalledMembers('/nonexistent/path');
    assert.strictEqual(installed.size, 0);
  });

  test('MemberItem: watching status produces eye icon description', () => {
    const item = new MemberItem('the-scribe', 'watching');
    assert.strictEqual(item.description, 'watching');
    assert.strictEqual(item.contextValue, 'member-watching');
  });

  test('MemberItem: triggered status produces activated description', () => {
    const item = new MemberItem('the-scribe', 'triggered');
    assert.strictEqual(item.description, 'activated');
    assert.strictEqual(item.contextValue, 'member-triggered');
  });

  test('MemberItem: not-installed status produces correct description', () => {
    const item = new MemberItem('the-scribe', 'not-installed');
    assert.strictEqual(item.description, 'not installed');
    assert.strictEqual(item.contextValue, 'member-not-installed');
  });

  test('all 14 members have a display name mapping', () => {
    for (const member of AGENTHOOD_MEMBERS) {
      const item = new MemberItem(member, 'watching');
      assert.ok(item.label, `${member} should have a display name`);
    }
  });
});
