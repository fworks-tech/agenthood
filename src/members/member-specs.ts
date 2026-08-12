import type { PermissionProfile, ProviderName, MemberCategory } from './types.ts'

export interface RawSpec {
  name: string
  description: string
  tagline: string
  category: MemberCategory
  permissionProfile: PermissionProfile
  preferredProvider: ProviderName
  /**
   * The lane map's "Owned Decisions" — what only this member may decide.
   * Must mirror the Lane Map table in skills/the-sentinel/SKILL.md
   * (parity enforced by tests/unit/members/lane-map-parity.test.ts).
   * Shared tokens between members = lane overlap (verify --strict).
   */
  ownedDecisions: string[]
}

export const rawSpecs: RawSpec[] = [
  {
    name: 'the-scribe',
    description: 'Writes conventional commit messages, PR descriptions, and changelogs',
    tagline: 'Commits, PRs, changelogs',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Commit messages', 'PR descriptions'],
  },
  {
    name: 'the-architect',
    description: 'Drives spec-first development, task decomposition, and architecture decisions',
    tagline: 'Specs, planning, ADRs',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Specs', 'ADRs', 'Task decomposition', 'Branch scope'],
  },
  {
    name: 'the-builder',
    description: 'Turns concrete requirements into the smallest verified code change',
    tagline: 'Coding and implementation',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Smallest verified change', 'Local validation', 'Handoff'],
  },
  {
    name: 'the-reviewer',
    description: 'Conducts five-axis code review: correctness, security, performance, maintainability, test coverage',
    tagline: 'Five-axis code review',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Review criteria', 'Approval gates'],
  },
  {
    name: 'the-tester',
    description: 'Writes tests before implementation (TDD), maintains coverage targets, and validates acceptance criteria',
    tagline: 'TDD and test generation',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['TDD process', 'Coverage targets', 'Test types'],
  },
  {
    name: 'the-debugger',
    description: 'Five-step debugging protocol: reproduce, isolate, hypothesize, test, fix',
    tagline: 'Root cause analysis',
    category: 'engineering',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Root cause protocol', 'Investigation steps'],
  },
  {
    name: 'the-auditor',
    description: 'OWASP Top 10 security review, dependency audit, secrets scanning',
    tagline: 'Security and dependencies',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['OWASP', 'Secrets', 'Dependency vulnerabilities'],
  },
  {
    name: 'the-herald',
    description: 'Manages semver determination, changelog generation, and release publishing',
    tagline: 'Releases and versioning',
    category: 'lifecycle',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Semver', 'changelogs', 'Release notes'],
  },
  {
    name: 'the-librarian',
    description: 'Keeps documentation synchronized with code changes',
    tagline: 'Documentation and ADRs',
    category: 'knowledge',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['ADR storage', 'Doc sync', 'Knowledge management'],
  },
  {
    name: 'the-doorman',
    description: 'Validates commit messages against conventional commit rules. Gatekeeps every commit',
    tagline: 'Validation and enforcement',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'ollama',
    ownedDecisions: ['Hook setup', 'Lint', 'Gate checks', 'Health checks'],
  },
  {
    name: 'the-oracle',
    description: 'Cross-session institutional memory. Retrieves past decisions, patterns, and context',
    tagline: 'Research and knowledge',
    category: 'knowledge',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Member templates', 'Naming', 'Registration maps'],
  },
  {
    name: 'the-envoy',
    description: 'Cross-runtime translator. Adapts skills for non-Anthropic providers',
    tagline: 'Communication and handoffs',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Skill format mapping', 'Bootstrap', 'Skill matrix'],
  },
  {
    name: 'the-sentinel',
    description: 'Guards quality standards: validates member schema, ADR presence, CI gate integrity',
    tagline: 'Member file validation',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Member consistency', 'Contradiction detection', 'Drift'],
  },
  {
    name: 'the-warden',
    description: 'Enforces project conventions: file naming, directory structure, import rules',
    tagline: 'File size enforcement',
    category: 'validation',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Smell identification', 'Architectural decay', 'Complexity'],
  },
  {
    name: 'the-strategist',
    description: 'Translates ambiguous goals into structured problem statements, success criteria, and ranked priorities',
    tagline: 'Goal refinement and requirement discovery',
    category: 'engineering',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Problem statements', 'Success measures', 'Ranked priorities'],
  },
  {
    name: 'the-steward',
    description: 'Monitors context window capacity, routes tasks to the minimal required member set',
    tagline: 'Context and routing',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'groq',
    ownedDecisions: ['Member routing', 'Cache strategy', 'Session triage'],
  },
  {
    name: 'the-operator',
    description: 'Manages runtime health, deployment, incidents, rollback, and monitoring',
    tagline: 'Deployment, incidents, rollback',
    category: 'lifecycle',
    permissionProfile: 'restricted',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Deployment', 'Incidents', 'Rollback', 'Monitoring'],
  },
  {
    name: 'the-mailman',
    description: 'Manages message delivery, content scheduling, notification dispatch, and cross-posting across channels',
    tagline: 'Delivery and cross-posting',
    category: 'lifecycle',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Message dispatch', 'Content scheduling', 'Cross-posting'],
  },
  {
    name: 'the-inspector',
    description: 'Solves and generates challenging visual-reasoning benchmarks: pixel ranking, cross-panel mapping, graph-cut classification, and confidence estimation',
    tagline: 'Pixel-level visual reasoning',
    category: 'validation',
    permissionProfile: 'standard',
    preferredProvider: 'anthropic',
    ownedDecisions: ['Pixel-level analysis', 'Multi-panel correspondence'],
  },
]
