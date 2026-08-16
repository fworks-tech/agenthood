// Roles safe to delegate to from a restricted-delegation agent. Shared by
// DeveloperAgent and MemberAgent so the allowlist cannot drift apart.
export const DELEGATION_ALLOWED_ROLES = ['architect', 'qa', 'reviewer', 'the-oracle'] as const
