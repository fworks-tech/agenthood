import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// End-to-end: drive the *built* CLI as a real subprocess through the read-only
// user journey (#673). Complements the tarball smoke test in
// .github/scripts/package-smoke.sh (which covers npm install) by exercising
// command dispatch + member/skill discovery against the local build, with no
// LLM/network. Skips cleanly when dist/ is not built so it never fails a job
// that didn't run `npm run build`.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliPath = join(repoRoot, 'dist', 'cli.js');

type CliResult = { code: number; out: string };

function cli(...args: string[]): CliResult {
  const cwd = mkdtempSync(join(tmpdir(), 'agenthood-e2e-'));
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: String(stdout ?? '') };
  } catch (err) {
    // execFileSync throws on a non-zero exit; status/stdout/stderr carry the run.
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const suite = existsSync(cliPath) ? describe : describe.skip;

suite('agenthood CLI end-to-end journey (#673)', () => {
  it('reports its version', () => {
    const { code } = cli('--version');
    expect(code).toBe(0);
  });

  it('prints usage on --help', () => {
    const { code, out } = cli('--help');
    expect(code).toBe(0);
    expect(out).toMatch(/list|run|init/);
  });

  it('lists the Society members from the built package', () => {
    const { code, out } = cli('list');
    expect(code).toBe(0);
    expect(out).toContain('the-scribe');
    expect(out).toContain('the-architect');
  });

  it('reports status in a clean project without erroring', () => {
    const { code, out } = cli('status');
    expect(code).toBe(0);
    expect(out).toMatch(/Members:/);
  });

  it('rejects an unknown command with a non-zero exit', () => {
    const { code, out } = cli('totally-not-a-command');
    expect(code).toBe(1);
    expect(out).toMatch(/Unknown command/i);
  });
});
