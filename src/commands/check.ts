/**
 * agenthood check
 *
 * The Doorman's health check. Verifies that the Initiation
 * is complete and all standards are in place.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { MEMBER_NAMES, resolveSkillsDir } from '../members.js';
import { validateApiKeys } from '../llm/validateApiKeys.js';
import type { LLMConfig } from '../llm/types.js';

interface CheckResult {
  label: string;
  pass: boolean;
  detail?: string;
}

export async function check(): Promise<void> {
  const cwd = process.cwd();
  const results: CheckResult[] = [];

  const file = (label: string, path: string) =>
    results.push({ label, pass: existsSync(join(cwd, path)) });

  const cmd = (label: string, command: string) => {
    try {
      execSync(command, { cwd, stdio: 'pipe' });
      results.push({ label, pass: true });
    } catch {
      results.push({ label, pass: false });
    }
  };

  // Conventions
  file('.gitmessage configured', '.gitmessage');
  file('commitlint.config.ts present', 'commitlint.config.ts');

  // Hooks — .githooks/ (Agenthood repo) or .husky/ (target project)
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

  // GitHub templates
  file('.github/pull_request_template.md present', '.github/pull_request_template.md');
  file('.github/ISSUE_TEMPLATE/bug_report.md present', '.github/ISSUE_TEMPLATE/bug_report.md');
  file('.github/ISSUE_TEMPLATE/feature_request.md present', '.github/ISSUE_TEMPLATE/feature_request.md');

  // CI workflows
  file('.github/workflows/commitlint.yml present', '.github/workflows/commitlint.yml');

  // Skills
  const skillsBase = resolveSkillsDir(cwd);

  const installedCount = MEMBER_NAMES.filter((m) =>
    existsSync(join(skillsBase, m, `${m}.md`)),
  ).length;

  results.push({
    label: `Member skills installed (${installedCount}/${MEMBER_NAMES.length})`,
    pass: installedCount === MEMBER_NAMES.length,
  });

  // Git template
  cmd('git commit.template configured', 'git config --get commit.template');

  // AGENTS.md
  file('AGENTS.md present', 'AGENTS.md');

  // API key validation (only when a remote provider is explicitly configured)
  const configPath = join(cwd, '.agenthood', 'config.json');
  if (existsSync(configPath)) {
    let provider: string | undefined;
    let rawConfig: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      rawConfig = parsed;
      const p = parsed.provider;
      provider = typeof p === 'string' ? p : (p as Record<string, unknown> | undefined)?.name as string | undefined;
    } catch {
      // ignore — treat as no provider configured
    }

    if (provider && rawConfig) {
      try {
        validateApiKeys(rawConfig as LLMConfig);
        results.push({ label: `LLM API key configured (${provider})`, pass: true });
      } catch {
        results.push({ label: `LLM API key configured (${provider})`, pass: false });
      }
    }
  }

  // Memory stores
  file('LanceDB vector store initialized', '.agenthood/memory/vectors');
  file('Residual memory traces found', '.agenthood/residual.json');
  file('Knowledge graph found', '.agenthood/graph.json');

  // Memory tiers
  file('ShortTermMemory available', 'src/memory/ShortTermMemory.ts');
  file('LongTermMemory available', 'src/memory/LongTermMemory.ts');
  file('EpisodicMemory available', 'src/memory/EpisodicMemory.ts');
  file('ProjectMemory available', 'src/memory/ProjectMemory.ts');

  // RAG pipeline
  file('RAG Indexer available', 'src/rag/Indexer.ts');
  file('RAG Retriever available', 'src/rag/Retriever.ts');
  file('Chunk strategy configured', 'src/rag/ChunkStrategy.ts');

  // Society index
  file('Society index (members, ADRs, conventions)', '.agenthood/society-graph.json');

  // Report
  const passing = results.filter((r) => r.pass).length;
  const failing = results.filter((r) => !r.pass).length;

  console.log('\n🏛️  Agenthood Health Check\n');

  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}`);
  }

  console.log(`\n  ${passing} passing · ${failing} failing\n`);

  if (failing === 0) {
    console.log('  The Society is ready. You may proceed.\n');
  } else {
    console.log('  Run `npx agenthood init` to complete the initiation.\n');
    process.exit(1);
  }
}
