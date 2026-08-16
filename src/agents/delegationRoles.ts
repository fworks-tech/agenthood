// Roles safe to delegate to. Delegation may never hand write capability to a
// subagent the caller does not itself have, so only read-only analysis agents
// qualify: architect and qa hold write skills (WriteFileSkill/WriteCodeSkill)
// and are intentionally excluded. Shared by DeveloperAgent and MemberAgent so
// the allowlist cannot drift apart.
export const DELEGATION_ALLOWED_ROLES = ['reviewer', 'the-oracle'] as const
