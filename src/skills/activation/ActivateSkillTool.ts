import type { ITool, ToolResult } from '../../tools/ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import { TokenCounter } from '../../core/TokenCounter.ts'
import { recordSkillActivation } from './SkillStats.ts'
import { SkillBudget } from './SkillBudget.ts'

export const SKILL_ACTIVATION_PREFIX = '[SKILL_ACTIVATION]'

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

  private readonly budget: SkillBudget

  constructor(
    private manifests: Map<string, ISkillManifest>,
    contextWindow?: number,
  ) {
    this.budget = new SkillBudget(new TokenCounter(), contextWindow)
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { skill_name } = input as { skill_name: string }

    const manifest = this.manifests.get(skill_name)
    if (!manifest) {
      const available = Array.from(this.manifests.keys()).join(', ')
      recordSkillActivation(context.project.localPath, skill_name, false)
      return {
        success: false,
        output: '',
        error: `Skill "${skill_name}" not found. Available skills: ${available || '(none)'}`,
      }
    }

    const resourcesBlock = manifest.resources.length > 0
      ? `\n<skill_resources>\n${manifest.resources.map((r) => `  <file>${r}</file>`).join('\n')}\n</skill_resources>`
      : ''

    // A body already in the transcript cannot be shrunk later, so the budget is
    // applied here, against what is already loaded.
    const fit = this.budget.fit(manifest.body)
    const budgetNotice = fit.compressed
      ? `\n<skill_budget>Instructions compressed to fit the context window — saved ~${fit.savedTokens} tokens. Re-read SKILL.md from the skill directory for the full steps.</skill_budget>`
      : ''

    const output = `${SKILL_ACTIVATION_PREFIX}
<skill_content name="${manifest.name}">
${fit.body}${budgetNotice}
Skill directory: ${manifest.directory}
Relative paths in this skill are relative to the skill directory.${resourcesBlock}
</skill_content>`

    recordSkillActivation(context.project.localPath, manifest.name, true)
    return { success: true, output }
  }

}
