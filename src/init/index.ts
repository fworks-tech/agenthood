import { installConventions, installHooks, installGitHubTemplates, installWorkflows, installSkills, configureGitTemplate, scaffoldConfig, initDecisionLog, initMetrics } from './setup.js'
import { initVectorStore, initResidualMemory } from './store.js'
import { indexSociety } from './society.js'
import { promptRuntime, promptMembers, setupPersonalisation } from './ui.js'

export async function init(): Promise<void> {
  const cwd = process.cwd()

  console.log('\n🏛️  Welcome to the Agenthood.\n')
  console.log('The Initiation is beginning.\n')

  const runtime = await promptRuntime()
  const members = await promptMembers()

  const steps: Array<[string, () => Promise<void>]> = [
    ['Conventions', () => installConventions(cwd)],
    ['Git hooks', () => installHooks(cwd)],
    ['GitHub templates', () => installGitHubTemplates(cwd)],
    ['CI workflows', () => installWorkflows(cwd)],
    ['Member skills', () => installSkills(cwd, runtime, members)],
    ['Git commit template', () => configureGitTemplate(cwd)],
    ['Agenthood config', () => scaffoldConfig(cwd, runtime, members)],
    ['Vector store', () => initVectorStore(cwd)],
    ['Residual memory', () => initResidualMemory(cwd)],
    ['Society index', () => indexSociety(cwd)],
    ['Personalisation', () => setupPersonalisation(cwd)],
    ['Decision log', () => initDecisionLog(cwd)],
    ['Member metrics', () => initMetrics(cwd)],
  ]

  for (const [label, step] of steps) {
    process.stdout.write(`  Installing ${label}...`)
    try {
      await step()
      console.log(' ✅')
    } catch (err) {
      console.log(' ❌')
      console.error(`    Failed: ${err}`)
    }
  }

  console.log('\n🏛️  The Society is ready.\n')
  console.log('  Run `npx agenthood check` to verify the initiation.')
  console.log('  Run `npx agenthood oath` to read the oath.\n')
  console.log('  Your next commit will be reviewed by The Doorman.\n')
}
