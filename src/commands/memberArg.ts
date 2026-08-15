import { MEMBER_NAMES } from '../members.ts'

/** Shared usage/unknown-member validation for activate/deactivate */
export function requireMember(member: string | undefined, verb: string): string {
  if (!member) {
    console.error(`\nUsage: npx agenthood ${verb} <member>\n`)
    console.error('Members:', MEMBER_NAMES.join(', '))
    process.exit(1)
  }
  if (!MEMBER_NAMES.includes(member)) {
    console.error(`\nUnknown member: "${member}"`)
    console.error('Available members:', MEMBER_NAMES.join(', '))
    process.exit(1)
  }
  return member
}
