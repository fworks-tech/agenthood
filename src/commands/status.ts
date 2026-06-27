import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export async function status(): Promise<void> {
  const cwd = process.cwd()

  const membersDir = join(cwd, 'members')
  const memberCount = existsSync(membersDir)
    ? readdirSync(membersDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length
    : 0

  const decisionsDir = join(cwd, '.agenthood', 'decisions')
  const decisionCount = existsSync(decisionsDir)
    ? readdirSync(decisionsDir).filter((f) => f.endsWith('.json')).length
    : 0

  const checkpointsDir = join(cwd, '.agenthood', 'checkpoints')
  const checkpointCount = existsSync(checkpointsDir)
    ? readdirSync(checkpointsDir).filter((f) => f.endsWith('.json')).length
    : 0

  const lockPath = join(cwd, 'agenthood.lock')
  let lockStatus = 'absent'
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
      lockStatus = `valid (${Object.keys(lock.members || {}).length} members locked)`
    } catch {
      lockStatus = 'invalid'
    }
  }

  const memoryDir = join(cwd, '.agenthood', 'memory')
  const memoryInit = existsSync(memoryDir)

  console.log('\n  Agenthood Status\n')
  console.log(`  Members:     ${memberCount}`)
  console.log(`  Decisions:   ${decisionCount}`)
  console.log(`  Checkpoints: ${checkpointCount}`)
  console.log(`  Lockfile:    ${lockStatus}`)
  console.log(`  Memory:      ${memoryInit ? 'initialized' : 'not initialized'}`)
  console.log()
}
