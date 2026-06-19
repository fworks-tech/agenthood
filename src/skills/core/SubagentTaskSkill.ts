import type { ISkill, SkillResult } from "../ISkill.js";
import type { JSONSchema } from "../../llm/types.js";
import type { ExecutionContext } from "../../core/ExecutionContext.js";
import type { AgentRegistry } from "../../core/AgentRegistry.js";
import { AgentNotFoundError } from "../../core/AgentRegistry.js";

const inputSchema: JSONSchema = {
  type: "object",
  properties: {
    role: {
      type: "string",
      description: "Agent role to delegate to (e.g. developer, reviewer)",
    },
    task: { type: "string", description: "Task description for the subagent" },
  },
  required: ["role", "task"],
};

export class SubagentTaskSkill implements ISkill {
  name = "delegate_task";
  description =
    "Delegate a task to a specialized subagent. Use this for work that needs focused expertise or isolated context (e.g. code review, architecture planning, debugging). Returns the subagent output.";
  inputSchema = inputSchema;

  constructor(private agentRegistry: AgentRegistry) {}

  async execute(
    input: unknown,
    context: ExecutionContext,
  ): Promise<SkillResult> {
    const { role, task } = input as { role: string; task: string };

    try {
      const agent = this.agentRegistry.get(role);
      const result = await agent.run(task, context);
      return {
        success: true,
        output: result.output,
        artifacts: result.artifacts,
      };
    } catch (err) {
      if (err instanceof AgentNotFoundError) {
        return {
          success: false,
          output: "",
          error: `No agent found for role "${role}". Available: ${this.agentRegistry.list().join(", ")}`,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: `Subagent failed: ${msg}` };
    }
  }
}
