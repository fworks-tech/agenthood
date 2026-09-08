import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// postinstall.mjs is a guarded, default-off delegator: it exits 0 unless
// AGENTHOOD_AUTO_SETUP is set AND dist/cli.js exists, then spawns `setup` and
// propagates its exit code. A regression in either guard makes every `npm
// install` run network/setup or hang (#661), so we exercise the real script
// against a fake dist in a throwaway tree — never the live `setup`.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptSrc = readFileSync(join(repoRoot, 'scripts', 'postinstall.mjs'), 'utf8');

function runInstallScript(cli: string | null, env: Record<string, string>): { code: number } {
  const root = mkdtempSync(join(tmpdir(), 'agenthood-postinstall-'));
  try {
    // mirror the repo layout: <root>/scripts/postinstall.mjs + <root>/dist/cli.js
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'scripts', 'postinstall.mjs'), scriptSrc, 'utf8');
    if (cli !== null) {
      mkdirSync(join(root, 'dist'), { recursive: true });
      writeFileSync(join(root, 'dist', 'cli.js'), cli, 'utf8');
    }
    // strip the opt-in flag unless the case sets it, so the "default no-op"
    // assertion is deterministic regardless of the ambient shell/CI env.
    const childEnv: Record<string, string> = { ...process.env } as Record<string, string>;
    if (!('AGENTHOOD_AUTO_SETUP' in env)) delete childEnv.AGENTHOOD_AUTO_SETUP;
    Object.assign(childEnv, env);
    try {
      execFileSync(process.execPath, [join(root, 'scripts', 'postinstall.mjs')], {
        cwd: root,
        encoding: 'utf8',
        env: childEnv,
        stdio: 'ignore',
      });
      return { code: 0 };
    } catch (err) {
      return { code: (err as { status?: number }).status ?? 1 };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('postinstall.mjs (#661)', () => {
  it('is a silent no-op on a default install (no AGENTHOOD_AUTO_SETUP)', () => {
    // The guard that protects every consumer: nothing runs without opt-in.
    expect(runInstallScript(null, {}).code).toBe(0);
  });

  it('is still a no-op when AGENTHOOD_AUTO_SETUP is empty/falsy', () => {
    expect(runInstallScript('console.log(1)', { AGENTHOOD_AUTO_SETUP: '' }).code).toBe(0);
  });

  it('exits 0 without spawning when opted in but the CLI is not built', () => {
    expect(runInstallScript(null, { AGENTHOOD_AUTO_SETUP: '1' }).code).toBe(0);
  });

  it('runs the CLI setup and propagates its exit code when opted in and built', () => {
    // fake cli.js exits 7 -> postinstall must surface 7 (spawn + propagation)
    const code = runInstallScript('process.exit(7)', { AGENTHOOD_AUTO_SETUP: '1' }).code;
    expect(code).toBe(7);
  });

  it('is idempotent: the default no-op is stable across repeat installs', () => {
    const first = runInstallScript('process.exit(0)', {}).code;
    const second = runInstallScript('process.exit(0)', {}).code;
    expect([first, second]).toEqual([0, 0]);
  });
});
