import type { ITool, ToolResult } from '../../tools/ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'

const SKILL_ACTIVATION_PREFIX = '[SKILL_ACTIVATION]'

export class ActivateSkillTool implements ITool {
  name = 'activate_skill'
  description = 'Load the full instructions for a skill by name. Call this when a task matches a skill\'s description in the available skills list.'
  inputSchema = {
    type: 'object',
    properties: {
      skill_name: {
        type: 'string',
        description: 'Name of the skill to activate',
      },
    },
    required: ['skill_name'],
  }

  constructor(private manifests: Map<string, ISkillManifest>) {}

  async execute(input: unknown, _context: ExecutionContext): Promise<ToolResult> {
    const { skill_name } = input as { skill_name: string }

    const manifest = this.manifests.get(skill_name)
    if (!manifest) {
      const available = Array.from(this.manifests.keys()).join(', ')
      return {
        success: false,
        output: '',
        error: `Skill "${skill_name}" not found. Available skills: ${available || '(none)'}`,
      }
    }

    const resourcesBlock = manifest.resources.length > 0
      ? `\n<skill_resources>\n${manifest.resources.map((r) => `  <file>${r}</file>`).join('\n')}\n</skill_resources>`
      : ''

    const output = `${SKILL_ACTIVATION_PREFIX}
<skill_content name="${manifest.name}">
${manifest.body}
Skill directory: ${manifest.directory}
Relative paths in this skill are relative to the skill directory.${resourcesBlock}
</skill_content>`

    return { success: true, output }
  }

  static isSkillActivation(content: string): boolean {
    return content.startsWith(SKILL_ACTIVATION_PREFIX)
  }

  static getSkillName(content: string): string | null {
    const match = content.match(/<skill_content name="([^"]+)">/)
    return match ? match[1] : null
  }
}
