import type { PermissionProfile, ProviderName, MemberCategory } from './types.ts'

export interface RawSpec {
  name: string
  description: string
  tagline: string
  category: MemberCategory
  permissionProfile: PermissionProfile
  preferredProvider: ProviderName
}

export const rawSpecs: RawSpec[] = [
  {
    name: 'the-scribe',
    description: 'Writes conventional commit messages, PR descriptions, and changelogs',
    tagline: 'Commits, PRs, changelogs',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-architect',
    description: 'Drives spec-first development, task decomposition, and architecture decisions',
    tagline: 'Specs, planning, ADRs',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-reviewer',
    description: 'Conducts five-axis code review: correctness, security, performance, maintainability, test coverage',
    tagline: 'Five-axis code review',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-tester',
    description: 'Writes tests before implementation (TDD), maintains coverage targets, and validates acceptance criteria',
    tagline: 'TDD and test generation',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-debugger',
    description: 'Five-step debugging protocol: reproduce, isolate, hypothesize, test, fix',
    tagline: 'Root cause analysis',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-auditor',
    description: 'OWASP Top 10 security review, dependency audit, secrets scanning',
    tagline: 'Security and dependencies',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-herald',
    description: 'Manages semver determination, changelog generation, and release publishing',
    tagline: 'Releases and versioning',
    category: 'lifecycle',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-librarian',
    description: 'Keeps documentation synchronized with code changes',
    tagline: 'Documentation and ADRs',
    category: 'knowledge',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-doorman',
    description: 'Validates commit messages against conventional commit rules. Gatekeeps every commit',
    tagline: 'Validation and enforcement',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'ollama',
  },
  {
    name: 'the-oracle',
    description: 'Cross-session institutional memory. Retrieves past decisions, patterns, and context',
    tagline: 'Research and knowledge',
    category: 'knowledge',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-envoy',
    description: 'Cross-runtime translator. Adapts skills for non-Anthropic providers',
    tagline: 'Communication and handoffs',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-sentinel',
    description: 'Guards quality standards: validates member schema, ADR presence, CI gate integrity',
    tagline: 'Member file validation',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-warden',
    description: 'Enforces project conventions: file naming, directory structure, import rules',
    tagline: 'File size enforcement',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-strategist',
    description: 'Translates ambiguous goals into structured problem statements, success criteria, and ranked priorities',
    tagline: 'Goal refinement and requirement discovery',
    category: 'engineering',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-steward',
    description: 'Monitors context window capacity, routes tasks to the minimal required member set',
    tagline: 'Context and routing',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'groq',
  },
  {
    name: 'the-operator',
    description: 'Manages runtime health, deployment, incidents, rollback, and monitoring',
    tagline: 'Deployment, incidents, rollback',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-mailman',
    description: 'Manages message delivery, content scheduling, notification dispatch, and cross-posting across channels',
    tagline: 'Delivery and cross-posting',
    category: 'lifecycle',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
  {
    name: 'the-inspector',
    description: 'Solves and generates challenging visual-reasoning benchmarks: pixel ranking, cross-panel mapping, graph-cut classification, and confidence estimation',
    tagline: 'Pixel-level visual reasoning',
    category: 'validation',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
  },
]
