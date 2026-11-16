/**
 * `run_skill_script` — the model-facing wrapper around the only spawn path
 * (ADR-036). The tool itself adds no policy: activation, path guarding,
 * pinning, sandboxing and auditing all live in `runSkillScript`.
 */

import type { ITool, ToolResult } from '../../tools/ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import type { JSONSchema } from '../../llm/types.ts'
import { runSkillScript, type RunScriptDeps, type RunScriptRequest } from './runSkillScript.ts'

export class RunSkillScriptTool implements ITool {
  name = 'run_skill_script'
  description = [
    'Run a script bundled with an active skill, or a version-pinned one-off command.',
    'The skill must be activated first. `script` is a path relative to the skill directory (scripts/extract.py)',
    'or a pinned reference (uvx ruff@0.8.0 check .). Pass `args` to give it options, including --dry-run.',
    'Large output is written to a file; call again with the same script and { "page": 1 } to read it.',
  ].join(' ')
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      skill: { type: 'string', description: 'Name of the active skill that ships the script' },
      script: { type: 'string', description: 'Path relative to the skill directory, or a pinned one-off command' },
      args: { type: 'array', items: { type: 'string' }, description: 'Arguments passed to the script unchanged' },
      page: { type: 'integer', description: 'Read a page of previously spilled output instead of running' },
      page_size: { type: 'integer', description: 'Lines per page, default 200' },
      no_cache: { type: 'boolean', description: 'Bypass the output cache for this call' },
    },
    required: ['script'],
  }

  constructor(private deps: Omit<RunScriptDeps, 'projectPath' | 'executionId'>) {}

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    return runSkillScript(input as RunScriptRequest, {
      ...this.deps,
      projectPath: context.project.localPath,
      executionId: context.executionId,
    })
  }
}
