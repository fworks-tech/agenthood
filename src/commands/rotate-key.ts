import { createInterface } from 'node:readline'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { LLMRouter } from '../llm/LLMRouter.ts'
import type { LLMConfig } from '../llm/types.ts'
import { loadConfig } from './config.ts'
import type { CommandDescriptor } from './types.ts'

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function validateKey(provider: string, key: string): Promise<boolean> {
  const testConfig: LLMConfig = { provider, apiKey: key, model: 'test' }
  try {
    const inst = await LLMRouter.reinitializeProvider(provider, testConfig)
    if (!inst) return false
    await inst.chat([{ role: 'user', content: 'ping' }])
    return true
  } catch {
    return false
  }
}

export const command: CommandDescriptor = {
  name: 'rotate-key',
  description: 'Rotate API key for a provider with validation and hot-reload',
  handler: (args) => rotateKeyHandler(args),
}

async function rotateKeyHandler(args: string[]): Promise<void> {
  const provider = args[0]
  if (!provider) {
    console.error('Usage: agenthood rotate-key <provider>')
    console.error('Example: agenthood rotate-key groq')
    process.exit(1)
  }

  if (!LLMRouter.knownProviders().includes(provider)) {
    console.error(`Unknown provider: ${provider}`)
    console.error(`Known: ${LLMRouter.knownProviders().join(', ')}`)
    process.exit(1)
  }

  const newKey = await prompt(`Enter new API key for ${provider}: `)
  if (!newKey) {
    console.error('No key provided.')
    process.exit(1)
  }

  console.log('Validating new key...')
  const valid = await validateKey(provider, newKey)
  if (!valid) {
    console.error('Key validation failed. Key not saved.')
    process.exit(2)
  }

  const config = await loadConfig()
  const configPath = join(process.cwd(), '.agenthood', 'config.json')

  if (config.providers) {
    const entry = config.providers.find((p) => p.name === provider)
    if (entry) entry.apiKey = newKey
  }
  if (config.provider === provider) {
    config.apiKey = newKey
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')

  await LLMRouter.reinitializeProvider(provider, config)

  console.log(`Key for ${provider} rotated and reloaded.`)
}
