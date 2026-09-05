/**
 * Agenthood MCP Server
 *
 * Exposes agenthood skills as MCP tools.
 * Run with: agenthood mcp
 *
 * Tools:
 *   - list_skills: List all available skills
 *   - activate_skill: Load a skill's full instructions
 *   - run_member: Execute a member agent on a task
 */

import { McpServer } from '@modelcontextprotocol/server'
import { SkillDiscovery } from '../skills/discovery/SkillDiscovery.ts'
import { MemberRegistry } from '../members/MemberRegistry.ts'
import { resolveSkillsDir } from '../members.ts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Readable, Writable } from 'node:stream'

class StdioTransport {
  private input: Readable
  private output: Writable
  onmessage?: (message: unknown) => void
  onclose?: () => void
  onerror?: (error: Error) => void

  constructor(input: Readable, output: Writable) {
    this.input = input
    this.output = output
  }

  async start(): Promise<void> {
    let buffer = ''
    this.input.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line)
            this.onmessage?.(message)
          } catch {
            // skip non-JSON lines
          }
        }
      }
    })
    this.input.on('end', () => this.onclose?.())
    this.input.on('error', (err) => this.onerror?.(err as Error))
  }

  async send(message: unknown): Promise<void> {
    const json = JSON.stringify(message)
    this.output.write(json + '\n')
  }

  async close(): Promise<void> {
    this.onclose?.()
  }
}

function getDiscovery(cwd: string): SkillDiscovery {
  const discovery = new SkillDiscovery()
  discovery.discover(cwd)
  return discovery
}

function createServer(): McpServer {
  const server = new McpServer({
    name: 'agenthood',
    version: '3.45.0',
  })

  server.registerTool(
    'list_skills',
    {
      description: 'List all available Agenthood skills with their names and descriptions',
    },
    async () => {
      const cwd = process.cwd()
      const discovery = getDiscovery(cwd)
      const skills = discovery.list()

      if (skills.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No skills found. Run `agenthood init` or `agenthood install` to add skills.' }],
        }
      }

      const lines = skills.map((s) => `- **${s.name}**: ${s.description}`)
      return {
        content: [{ type: 'text' as const, text: `Found ${skills.length} skills:\n\n${lines.join('\n')}` }],
      }
    },
  )

  server.registerTool(
    'activate_skill',
    {
      description: 'Load the full instructions for a specific skill. Pass the skill name as the "name" argument.',
    },
    async (args: Record<string, unknown>) => {
      const name = args.name as string
      if (!name || typeof name !== 'string') {
        return {
          content: [{ type: 'text' as const, text: 'Missing required argument: name' }],
          isError: true,
        }
      }

      const cwd = process.cwd()
      const discovery = getDiscovery(cwd)
      const skill = discovery.get(name)

      if (!skill) {
        return {
          content: [{ type: 'text' as const, text: `Skill "${name}" not found. Use list_skills to see available skills.` }],
          isError: true,
        }
      }

      return {
        content: [{ type: 'text' as const, text: `<skill_content name="${skill.name}">\n${skill.body}\n</skill_content>` }],
      }
    },
  )

  server.registerTool(
    'run_member',
    {
      description: 'Get info about a member and how to execute it. Pass member name and task as arguments.',
    },
    async (args: Record<string, unknown>) => {
      const member = args.member as string
      const task = args.task as string

      if (!member || typeof member !== 'string') {
        return {
          content: [{ type: 'text' as const, text: 'Missing required argument: member' }],
          isError: true,
        }
      }
      if (!task || typeof task !== 'string') {
        return {
          content: [{ type: 'text' as const, text: 'Missing required argument: task' }],
          isError: true,
        }
      }

      const cwd = process.cwd()
      const registry = new MemberRegistry()
      const spec = registry.get(member)

      if (!spec) {
        return {
          content: [{ type: 'text' as const, text: `Member "${member}" not found.` }],
          isError: true,
        }
      }

      const skillsDir = resolveSkillsDir(cwd)
      const skillPath = join(skillsDir, member, 'SKILL.md')

      if (!existsSync(skillPath)) {
        return {
          content: [{ type: 'text' as const, text: `Member "${member}" is not installed. Run \`agenthood activate ${member}\` first.` }],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Member: ${member}\nTagline: ${spec.tagline}\n\nTo execute: \`agenthood run ${member} "${task}"\``,
          },
        ],
      }
    },
  )

  return server
}

export async function startMcpServer(): Promise<void> {
  const server = createServer()
  const transport = new StdioTransport(process.stdin, process.stdout)
  await server.connect(transport)
  process.stderr.write('[agenthood] MCP server started on stdio\n')
}
