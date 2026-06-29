/**
 * agenthood setup
 *
 * Self-setup for the Agenthood repo itself.
 * Activates .githooks/, sets core.hooksPath, and wires the commit template.
 * Replaces setup.sh — runs automatically via postinstall.
 */

import { chmodSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')

export async function setup(): Promise<void> {
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  Agenthood — Activating Enforcement Layer                   │')
  console.log('└─────────────────────────────────────────────────────────────┘\n')

  const steps: Array<[string, () => void]> = [
    ['git hooks path → .githooks/', activateHooksPath],
    ['hooks made executable', makeHooksExecutable],
    ['commit template → docs/conventions/.gitmessage', setCommitTemplate],
  ]

  for (const [label, step] of steps) {
    try {
      step()
      console.log(`✓  ${label}`)
    } catch (err) {
      console.error(`✗  ${label}\n   ${err}`)
      process.exit(1)
    }
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  Active Hooks                                               │')
  console.log('├─────────────────────────────────────────────────────────────┤')
  console.log('│  commit-msg         The Doorman — commit message validation │')
  console.log('│  pre-commit         The Doorman — block commits to main     │')
  console.log('│                     The Auditor — secret scanning           │')
  console.log('│                     The Warden  — file size warning         │')
  console.log('│  prepare-commit-msg             — template injection        │')
  console.log('│  pre-push           The Doorman — block push to main        │')
  console.log('└─────────────────────────────────────────────────────────────┘\n')
  console.log('The Society is watching. Ship with confidence.\n')
}

function activateHooksPath(): void {
  execSync('git config core.hooksPath .githooks', { cwd: REPO_ROOT, stdio: 'pipe' })
}

function makeHooksExecutable(): void {
  const hooksDir = join(REPO_ROOT, '.githooks')
  if (!existsSync(hooksDir)) return
  for (const file of readdirSync(hooksDir)) {
    chmodSync(join(hooksDir, file), 0o755)
  }
}

function setCommitTemplate(): void {
  execSync('git config commit.template docs/conventions/.gitmessage', {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  })
}
