export interface MemberTrigger {
  name: string
  keywords: string[]
  filePatterns: string[]
  contexts: string[]
  stages: TaskStage[]
}

export type TaskStage = 'spec' | 'implement' | 'test' | 'review' | 'commit' | 'release' | 'deploy' | 'audit'

export const MEMBER_TRIGGERS: MemberTrigger[] = [
  {
    name: 'the-scribe',
    keywords: ['commit', 'commit message', 'pr description', 'changelog', 'release notes'],
    filePatterns: [],
    contexts: ['ready_to_commit', 'pr_open', 'release_prep'],
    stages: ['commit', 'release'],
  },
  {
    name: 'the-architect',
    keywords: ['spec', 'design', 'architecture', 'plan', 'blueprint', 'requirements', 'system design'],
    filePatterns: [],
    contexts: ['feature_start', 'unclear_requirements', 'design_needed'],
    stages: ['spec'],
  },
  {
    name: 'the-reviewer',
    keywords: ['review', 'pr', 'pull request', 'merge', 'diff', 'code review'],
    filePatterns: ['src/**/*.ts', 'src/**/*.js'],
    contexts: ['pr_review', 'code_changes'],
    stages: ['review'],
  },
  {
    name: 'the-tester',
    keywords: ['test', 'coverage', 'tdd', 'unit test', 'integration test', 'e2e'],
    filePatterns: ['src/**/*.ts', '!**/*.test.ts', '!tests/**/*.test.ts'],
    contexts: ['code_without_tests', 'test_failure'],
    stages: ['test', 'implement'],
  },
  {
    name: 'the-debugger',
    keywords: ['debug', 'error', 'bug', 'fix', 'failure', 'crash', 'trace', 'diagnose'],
    filePatterns: [],
    contexts: ['error_encountered', 'ci_failure', 'test_failure'],
    stages: ['test'],
  },
  {
    name: 'the-auditor',
    keywords: ['audit', 'security', 'vulnerability', 'secret', 'exploit', 'owasp', 'dependency audit'],
    filePatterns: [],
    contexts: ['security_review', 'dependency_update'],
    stages: ['audit'],
  },
  {
    name: 'the-herald',
    keywords: ['release', 'version', 'bump', 'semver', 'changelog', 'publish', 'ship'],
    filePatterns: [],
    contexts: ['release_prep', 'version_bump'],
    stages: ['release'],
  },
  {
    name: 'the-librarian',
    keywords: ['docs', 'document', 'readme', 'adr', 'api reference', 'knowledge'],
    filePatterns: ['docs/**/*.md', '*.md', 'README.md'],
    contexts: ['docs_outdated', 'merge_to_main'],
    stages: ['review', 'release'],
  },
  {
    name: 'the-doorman',
    keywords: ['validate', 'commit message', 'branch', 'hook', 'health check', 'enforce'],
    filePatterns: [],
    contexts: ['pre_commit', 'pre_push', 'validation_needed'],
    stages: ['commit'],
  },
  {
    name: 'the-oracle',
    keywords: ['member', 'agenthood', 'society', 'convention', 'layer', 'skill', 'the-scribe'],
    filePatterns: ['members/**/*', 'AGENTS.md', 'conventions/**/*', '.opencode/**/*'],
    contexts: ['working_on_agenthood', 'agenthood_question'],
    stages: [],
  },
  {
    name: 'the-envoy',
    keywords: ['translate', 'provider', 'cursor', 'copilot', 'codex', 'bootstrap', 'skill format'],
    filePatterns: ['members/**/*.md', 'skills/**/*.md'],
    contexts: ['provider_migration', 'new_provider'],
    stages: [],
  },
  {
    name: 'the-sentinel',
    keywords: ['drift', 'consistency', 'contradiction', 'member file', 'structural'],
    filePatterns: ['members/**/*.md', 'conventions/**/*'],
    contexts: ['member_audit', 'drift_check'],
    stages: ['audit'],
  },
  {
    name: 'the-warden',
    keywords: ['code smell', 'complexity', 'dead code', 'boundary', 'duplication', 'dependency decay'],
    filePatterns: ['src/**/*.ts'],
    contexts: ['code_health_scan', 'pr_review'],
    stages: ['review', 'audit'],
  },
  {
    name: 'the-steward',
    keywords: ['context', 'token', 'session', 'routing', 'cache', 'triage', 'capacity'],
    filePatterns: [],
    contexts: ['session_start', 'context_heavy', 'session_end', 'task_switching'],
    stages: [],
  },
]
