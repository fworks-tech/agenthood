import { MEMBER_NAME_RE } from '../members.ts'
import { loadLockfile, type Lockfile } from '../utils/lockfile.ts'

/** Load agenthood.lock and resolve which members a command should act on.
 * The CLI target and every lockfile key are validated against
 * MEMBER_NAME_RE before they can become git pathspecs; lockfile keys are
 * attacker-influenced (cloned repos), so hostile ones are warned about
 * (never echoed raw) instead of acted on. Exits 1 on any failure. */
export function loadLockTargets(cwd: string, target: string | undefined, missingHint: string): { lock: Lockfile; members: string[] } {
  if (target && !MEMBER_NAME_RE.test(target)) {
    console.error(`Invalid member name: "${target}"`)
    process.exit(1)
  }

  const lock = loadLockfile(cwd)
  if (!lock) {
    console.error(missingHint)
    process.exit(1)
  }

  if (target && !lock.members[target]) {
    console.error(`Member "${target}" not found in lockfile.`)
    process.exit(1)
  }

  const keys = Object.keys(lock.members).filter((m) => MEMBER_NAME_RE.test(m))
  for (const bad of Object.keys(lock.members).filter((m) => !MEMBER_NAME_RE.test(m))) {
    // JSON.stringify: hostile keys are attacker bytes — never echo them raw
    console.warn(`Skipping invalid member key from lockfile: ${JSON.stringify(bad)}`)
  }
  return { lock, members: target ? [target] : keys }
}
