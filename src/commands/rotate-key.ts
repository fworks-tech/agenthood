import { createInterface } from 'node:readline'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import { LLMRouter } from '../llm/LLMRouter.ts'
import type { LLMConfig } from '../llm/types.ts'
import { writeFileAtomic } from '../utils/atomicWrite.ts'
import { loadConfig } from './config.ts'
import type { CommandDescriptor } from './types.ts'

function promptVisible(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/** Reads a secret without echoing it to the terminal. */
function promptSecret(question: string): Promise<string> {
  if (!process.stdin.isTTY) return promptVisible(question)
  process.stdout.write(question)
  return new Promise((resolve) => {
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    let value = ''
    const finish = (result: string): void => {
      stdin.off('data', onData)
      stdin.setRawMode(wasRaw ?? false)
      stdin.pause()
      process.stdout.write('\n')
      resolve(result)
    }
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish(value)
        if (ch === '\u0003') {
          stdin.setRawMode(wasRaw ?? false)
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') {
          value = value.slice(0, -1)
          continue
        }
        value += ch
      }
    }
    stdin.on('data', onData)
  })
}

/** `.agenthood/config.json` is deliberately not ignored, so a key written there
 *  is published by the next commit. */
function isTrackedByGit(path: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', path], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function validateKey(provider: string, key: string): Promise<boolean> {
  const testConfig: LLMConfig = { provider, apiKey: key, model: 'test' }
  try {
    const inst = await LLMRouter.reinitializeProvider(provider, testConfig)
    if (!inst) return false
    await inst.complete({ messages: [{ role: 'user', content: 'ping' }] })
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

  const newKey = await promptSecret(`Enter new API key for ${provider}: `)
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
  const configPath = join('.agenthood', 'config.json')
  if (isTrackedByGit(configPath) && !args.includes('--write-config')) {
    console.error(`${configPath} is tracked by git; writing a live key there publishes it.`)
    console.error('Use an environment variable or untracked config, or re-run with --write-config to write it anyway.')
    process.exit(1)
  }

  if (config.providers) {
    const entry = config.providers.find((p) => p.name === provider)
    if (entry) entry.apiKey = newKey
  }
  if (config.provider === provider) {
    config.apiKey = newKey
  }

  writeFileAtomic(join(process.cwd(), configPath), JSON.stringify(config, null, 2) + '\n')

  await LLMRouter.reinitializeProvider(provider, config)

  console.log(`Key for ${provider} rotated and reloaded.`)
}
