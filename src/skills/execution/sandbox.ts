/**
 * Docker sandbox for skill scripts (#607), and the trust rule that decides when
 * it is mandatory (#536). A sandbox flag that silently degrades to host
 * execution is worse than no flag, so a missing Docker binary fails closed.
 */

import { execFileSync } from 'node:child_process'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'

export interface SandboxDecision {
  /** True when the script must run in Docker. */
  required: boolean
  /** Why, for the error message when Docker is missing. */
  reason: string
}

let dockerAvailable: boolean | undefined

export function setDockerAvailable(value: boolean | undefined): void {
  dockerAvailable = value
}

/** Cached `docker info` probe: one 5s attempt per process. */
export function detectDocker(): boolean {
  if (dockerAvailable !== undefined) return dockerAvailable
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 5000 })
    dockerAvailable = true
  } catch {
    dockerAvailable = false
  }
  return dockerAvailable
}

/**
 * Official skills and authors the project trusts may run on the host. Anything
 * else needs `--sandbox`; asking is deliberate.
 */
export function sandboxRequired(
  manifest: Pick<ISkillManifest, 'tier' | 'owner'>,
  options: { sandbox: boolean; trustedAuthors: string[] },
): SandboxDecision {
  if (options.sandbox) return { required: true, reason: 'security.sandbox is enabled' }
  if (manifest.tier === 'official') return { required: false, reason: 'official skill' }
  if (manifest.owner && options.trustedAuthors.includes(manifest.owner)) {
    return { required: false, reason: `author ${manifest.owner} is trusted` }
  }
  return {
    required: true,
    reason: `tier "${manifest.tier}" runs untrusted code; pass --sandbox to isolate it`,
  }
}

/**
 * Docker arguments for a skill script. The skill directory is the only mount,
 * read-only; the project is not mounted, so a script cannot read it by accident
 * and network is denied outright.
 */
export function sandboxDockerArgs(skillDir: string, argv: string[]): string[] {
  return [
    'run',
    '--rm',
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=64m',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--memory',
    '512m',
    '--cpus',
    '1',
    '--pids-limit',
    '128',
    '-v',
    `${skillDir}:/skill:ro`,
    '-w',
    '/skill',
    ...argv,
  ]
}
