import { existsSync, readFileSync } from 'node:fs';
import type { CommandDescriptor } from './types.ts';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEMBER_NAMES, resolveSkillsDir } from '../members.ts';

interface CheckResult {
  label: string;
  isPassed: boolean;
}

function pushFileCheck(results: CheckResult[], basePath: string, label: string, relPath: string): void {
  results.push({ label, isPassed: existsSync(join(basePath, relPath)) });
}

export const command: CommandDescriptor = {
  name: 'check',
  description: "Run the Doorman's health check",
  handler: () => check(),
}

export async function check(): Promise<void> {
  const results: CheckResult[] = [];
  collectConfigChecks(results);
  collectMemoryResults(results);
  collectRagChecks(results);
  printReport(results);
}

function collectConfigChecks(results: CheckResult[]): void {
  const cwd = process.cwd();

  const file = (label: string, path: string) => pushFileCheck(results, cwd, label, path);

  collectSkillsCount(cwd, results);
  file('AGENTS.md present', 'AGENTS.md');
  collectApiKeyResult(cwd, results);
}

function collectRagChecks(results: CheckResult[]): void {
  const cwd = process.cwd();
  const file = (label: string, path: string) => pushFileCheck(results, cwd, label, path);

  file('Agenthood config found', '.agenthood/config.json');
}

function collectMemoryResults(results: CheckResult[]): void {
  const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  const pkgFile = (label: string, relPath: string) => pushFileCheck(results, PKG_ROOT, label, relPath);

  pkgFile('ShortTermMemory available', 'dist/memory/ShortTermMemory.js');
  pkgFile('LongTermMemory available', 'dist/memory/LongTermMemory.js');
  pkgFile('EpisodicMemory available', 'dist/memory/EpisodicMemory.js');
  pkgFile('ProjectMemory available', 'dist/memory/ProjectMemory.js');

  pkgFile('RAG Indexer available', 'dist/rag/Indexer.js');
  pkgFile('RAG Retriever available', 'dist/rag/Retriever.js');
  pkgFile('Chunk strategy configured', 'dist/rag/ChunkStrategy.js');
}

function collectSkillsCount(cwd: string, results: CheckResult[]): void {
  const skillsBase = resolveSkillsDir(cwd);
  const installedCount = MEMBER_NAMES.filter((m) =>
    existsSync(join(skillsBase, m, `${m}.md`)),
  ).length;
  results.push({
    label: `Member skills installed (${installedCount}/${MEMBER_NAMES.length})`,
    isPassed: installedCount === MEMBER_NAMES.length,
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
    const raw = parsed.provider;
    provider = typeof raw === 'string' ? raw : (raw as Record<string, unknown> | undefined)?.name as string | undefined;
  } catch {
    return;
  }

  if (!provider || !rawConfig) return;

  const PROVIDER_KEYS: Record<string, string> = {
    groq: 'GROQ_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  }
  const envVar = PROVIDER_KEYS[provider] ?? null;

  if (envVar && !process.env[envVar]) {
    results.push({ label: `LLM API key configured (${provider})`, isPassed: false });
  } else {
    results.push({ label: `LLM API key configured (${provider})`, isPassed: true });
  }
}

function printReport(results: CheckResult[]): void {
  const passing = results.filter((r) => r.isPassed).length;
  const failing = results.filter((r) => !r.isPassed).length;

  console.log('\n🏛️  Agenthood Health Check\n');

  for (const r of results) {
    console.log(`  ${r.isPassed ? '✅' : '❌'} ${r.label}`);
  }

  console.log(`\n  ${passing} passing · ${failing} failing\n`);

  if (failing === 0) {
    console.log('  The Society is ready. You may proceed.\n');
  } else {
    console.log('  Run `npx agenthood init` to complete the initiation.\n');
    process.exit(1);
  }
}
