/**
 * A host registering one custom member (#1040) and running it.
 * Run from a project root: `npx tsx examples/compose/compose.ts`
 */
import { ApplicationContext } from '../../src/runtime/ApplicationContext.ts'
import { loadConfigOrExit } from '../../src/commands/config.ts'

const config = await loadConfigOrExit()
const app = await ApplicationContext.create(process.cwd(), config, {
  customMembers: [{
    name: 'release-scribe',
    description: 'Writes release notes from a diff',
    systemPrompt: 'You write release notes. Read the diff, then list only user-visible changes.',
    permissionProfile: 'restricted',
    tools: ['file.read', 'file.search'],
    model: 'glm-5.3-flash',
  }],
})

const { output } = await app.runner.runMemberTask('release-scribe', 'Summarize the staged diff', config)
console.log(output)
await app.runner.flushTraces()
