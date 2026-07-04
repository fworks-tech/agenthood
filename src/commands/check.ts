import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { MEMBER_NAMES, resolveSkillsDir } from '../members.js';
import { validateApiKeys } from '../llm/validateApiKeys.js';
import type { LLMConfig } from '../llm/types.js';

interface CheckResult {
  label: string;
  passed: boolean;
}

export async function check(): Promise<void> {
  const results = collectResults();
  printReport(results);
}

function collectResults(): CheckResult[] {
  const cwd = process.cwd();
  const results: CheckResult[] = [];
  const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  const file = (label: string, path: string) =>
    results.push({ label, passed: existsSync(join(cwd, path)) });

  const pkgFile = (label: string, relPath: string) =>
    results.push({ label, passed: existsSync(join(PKG_ROOT, relPath)) });

  const cmd = (label: string, command: string) => {
    try {
      execSync(command, { cwd, stdio: 'pipe' });
      results.push({ label, passed: true });
    } catch {
      results.push({ label, passed: false });
    }
  };

  file('.gitmessage configured', '.gitmessage');
  file('commitlint.config.ts present', 'commitlint.config.ts');

  const usesGithooks = existsSync(join(cwd, '.githooks'));
  if (usesGithooks) {
    file('.githooks/commit-msg present', '.githooks/commit-msg');
    file('.githooks/pre-commit present', '.githooks/pre-commit');
    file('.githooks/pre-push present', '.githooks/pre-push');
    cmd('core.hooksPath set to .githooks', 'git config --get core.hooksPath');
  } else {
    file('Husky commit-msg hook active', '.husky/commit-msg');
    file('Husky pre-push hook active', '.husky/pre-push');
  }

  file('.github/pull_request_template.md present', '.github/pull_request_template.md');
  file('.github/ISSUE_TEMPLATE/bug_report.md present', '.github/ISSUE_TEMPLATE/bug_report.md');
  file('.github/ISSUE_TEMPLATE/feature_request.md present', '.github/ISSUE_TEMPLATE/feature_request.md');
  file('.github/workflows/commitlint.yml present', '.github/workflows/commitlint.yml');

  collectSkillsCount(cwd, results);

  cmd('git commit.template configured', 'git config --get commit.template');
  file('AGENTS.md present', 'AGENTS.md');

  collectApiKeyResult(cwd, results);

  file('LanceDB vector store initialized', '.agenthood/memory');
  file('Residual memory traces found', '.agenthood/residual.json');
  file('Knowledge graph found', '.agenthood/society-graph.json');

  pkgFile('ShortTermMemory available', 'dist/memory/ShortTermMemory.js');
  pkgFile('LongTermMemory available', 'dist/memory/LongTermMemory.js');
  pkgFile('EpisodicMemory available', 'dist/memory/EpisodicMemory.js');
  pkgFile('ProjectMemory available', 'dist/memory/ProjectMemory.js');

  pkgFile('RAG Indexer available', 'dist/rag/Indexer.js');
  pkgFile('RAG Retriever available', 'dist/rag/Retriever.js');
  pkgFile('Chunk strategy configured', 'dist/rag/ChunkStrategy.js');

  return results;
}

function collectSkillsCount(cwd: string, results: CheckResult[]): void {
  const skillsBase = resolveSkillsDir(cwd);
  const installedCount = MEMBER_NAMES.filter((m) =>
    existsSync(join(skillsBase, m, `${m}.md`)),
  ).length;
  results.push({
    label: `Member skills installed (${installedCount}/${MEMBER_NAMES.length})`,
    passed: installedCount === MEMBER_NAMES.length,
  });
}

function collectApiKeyResult(cwd: string, results: CheckResult[]): void {
  const configPath = join(cwd, '.agenthood', 'config.json');
  if (!existsSync(configPath)) return;

  let provider: string | undefined;
  let rawConfig: Record<string, unknown> | undefined;
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    rawConfig = parsed;
    const p = parsed.provider;
    provider = typeof p === 'string' ? p : (p as Record<string, unknown> | undefined)?.name as string | undefined;
  } catch {
    return;
  }

  if (!provider || !rawConfig) return;

  try {
    validateApiKeys(rawConfig as LLMConfig);
    results.push({ label: `LLM API key configured (${provider})`, passed: true });
  } catch {
    results.push({ label: `LLM API key configured (${provider})`, passed: false });
  }
}

function printReport(results: CheckResult[]): void {
  const passing = results.filter((r) => r.passed).length;
  const failing = results.filter((r) => !r.passed).length;

  console.log('\n🏛️  Agenthood Health Check\n');

  for (const r of results) {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.label}`);
  }

  console.log(`\n  ${passing} passing · ${failing} failing\n`);

  if (failing === 0) {
    console.log('  The Society is ready. You may proceed.\n');
  } else {
    console.log('  Run `npx agenthood init` to complete the initiation.\n');
    process.exit(1);
  }
}
