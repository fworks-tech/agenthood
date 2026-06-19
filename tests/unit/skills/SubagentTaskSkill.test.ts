import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubagentTaskSkill } from "../../../src/skills/core/SubagentTaskSkill.js";
import {
  AgentRegistry,
  AgentNotFoundError,
} from "../../../src/core/AgentRegistry.js";
import type { BaseAgent } from "../../../src/agents/base/BaseAgent.js";
import type { AgentResult } from "../../../src/agents/base/AgentResult.js";
import type { ExecutionContext } from "../../../src/core/ExecutionContext.js";
import { createTestContext } from "../../helpers/testContext.js";

function createMockAgent(
  role: string,
  output: string = "mock output",
): BaseAgent {
  return {
    role,
    run: vi.fn().mockResolvedValue({
      role,
      output,
      artifacts: [],
    } as AgentResult),
  } as unknown as BaseAgent;
}

describe("SubagentTaskSkill", () => {
  let registry: AgentRegistry;
  let skill: SubagentTaskSkill;
  let context: ExecutionContext;

  beforeEach(() => {
    registry = new AgentRegistry();
    skill = new SubagentTaskSkill(registry);
    context = createTestContext();
  });

  describe("basic properties", () => {
    it("has correct name", () => {
      expect(skill.name).toBe("delegate_task");
    });

    it("has descriptive description", () => {
      expect(skill.description.toLowerCase()).toContain("delegate");
      expect(skill.description.toLowerCase()).toContain("subagent");
    });

    it("has proper input schema", () => {
      expect(skill.inputSchema).toEqual({
        type: "object",
        properties: {
          role: {
            type: "string",
            description: "Agent role to delegate to (e.g. developer, reviewer)",
          },
          task: {
            type: "string",
            description: "Task description for the subagent",
          },
        },
        required: ["role", "task"],
      });
    });
  });

  describe("execute() - success cases", () => {
    it("delegates task to registered agent successfully", async () => {
      const reviewerAgent = createMockAgent("reviewer", "Code looks good!");
      registry.register(reviewerAgent);

      const result = await skill.execute(
        { role: "reviewer", task: "Review the login function" },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe("Code looks good!");
      expect(reviewerAgent.run).toHaveBeenCalledWith(
        "Review the login function",
        context,
      );
    });

    it("passes artifacts from subagent back to parent", async () => {
      const testerAgent = {
        role: "tester",
        run: vi.fn().mockResolvedValue({
          role: "tester",
          output: "Tests written",
          artifacts: [
            {
              type: "test" as const,
              path: "test.spec.ts",
              content: "test code",
              createdBy: "tester",
            },
          ],
        }),
      } as unknown as BaseAgent;

      registry.register(testerAgent);

      const result = await skill.execute(
        { role: "tester", task: "Write tests for auth module" },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts?.[0].path).toBe("test.spec.ts");
    });

    it("works with different agent types", async () => {
      const developer = createMockAgent("developer", "Code implemented");
      const auditor = createMockAgent("auditor", "Security scan complete");

      registry.register(developer);
      registry.register(auditor);

      const devResult = await skill.execute(
        { role: "developer", task: "Implement login" },
        context,
      );
      const auditResult = await skill.execute(
        { role: "auditor", task: "Check for vulnerabilities" },
        context,
      );

      expect(devResult.success).toBe(true);
      expect(devResult.output).toBe("Code implemented");
      expect(auditResult.success).toBe(true);
      expect(auditResult.output).toBe("Security scan complete");
    });

    it("awaits agent execution before returning", async () => {
      let executed = false;
      const slowAgent = {
        role: "slow",
        run: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executed = true;
          return { role: "slow", output: "done", artifacts: [] };
        }),
      } as unknown as BaseAgent;

      registry.register(slowAgent);

      const result = await skill.execute(
        { role: "slow", task: "slow task" },
        context,
      );

      expect(executed).toBe(true);
      expect(result.success).toBe(true);
    });
  });

  describe("execute() - error cases", () => {
    it("returns error when agent role not found", async () => {
      registry.register(createMockAgent("developer"));
      registry.register(createMockAgent("reviewer"));

      const result = await skill.execute(
        { role: "nonexistent", task: "some task" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.output).toBe("");
      expect(result.error).toContain('No agent found for role "nonexistent"');
    });

    it("lists available agents in error message", async () => {
      registry.register(createMockAgent("developer"));
      registry.register(createMockAgent("reviewer"));
      registry.register(createMockAgent("tester"));

      const result = await skill.execute(
        { role: "invalid", task: "task" },
        context,
      );

      expect(result.error).toContain("Available:");
      expect(result.error).toContain("developer");
      expect(result.error).toContain("reviewer");
      expect(result.error).toContain("tester");
    });

    it("handles subagent execution failure gracefully", async () => {
      const failingAgent = {
        role: "failing",
        run: vi.fn().mockRejectedValue(new Error("Agent crashed")),
      } as unknown as BaseAgent;

      registry.register(failingAgent);

      const result = await skill.execute(
        { role: "failing", task: "task" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.output).toBe("");
      expect(result.error).toBe("Subagent failed: Agent crashed");
    });

    it("handles non-Error exceptions from subagent", async () => {
      const failingAgent = {
        role: "failing",
        run: vi.fn().mockRejectedValue("string error"),
      } as unknown as BaseAgent;

      registry.register(failingAgent);

      const result = await skill.execute(
        { role: "failing", task: "task" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Subagent failed: string error");
    });

    it("returns empty artifacts array on failure", async () => {
      const result = await skill.execute(
        { role: "nonexistent", task: "task" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.artifacts).toBeUndefined();
    });
  });

  describe("context sharing", () => {
    it("passes same ExecutionContext to subagent", async () => {
      const agent = createMockAgent("agent");
      registry.register(agent);

      await skill.execute({ role: "agent", task: "task" }, context);

      expect(agent.run).toHaveBeenCalledWith("task", context);
      expect(agent.run).toHaveBeenCalledWith(expect.any(String), context);
    });

    it("allows subagent to access parent execution ID", async () => {
      const agent = {
        role: "agent",
        run: vi
          .fn()
          .mockImplementation(async (task: string, ctx: ExecutionContext) => {
            expect(ctx.executionId).toBe(context.executionId);
            return { role: "agent", output: "ok", artifacts: [] };
          }),
      } as unknown as BaseAgent;

      registry.register(agent);

      await skill.execute({ role: "agent", task: "task" }, context);

      expect(agent.run).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles empty agent registry", async () => {
      const result = await skill.execute(
        { role: "any", task: "task" },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Available: ");
    });

    it("handles agent returning empty output", async () => {
      const agent = createMockAgent("agent", "");
      registry.register(agent);

      const result = await skill.execute(
        { role: "agent", task: "task" },
        context,
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe("");
    });

    it("handles task with special characters", async () => {
      const agent = createMockAgent("agent");
      registry.register(agent);

      const specialTask = 'Review code with "quotes" and \n newlines';
      await skill.execute({ role: "agent", task: specialTask }, context);

      expect(agent.run).toHaveBeenCalledWith(specialTask, context);
    });

    it("handles role name with spaces (if registry allows)", async () => {
      const agent = createMockAgent("senior developer");
      registry.register(agent);

      const result = await skill.execute(
        { role: "senior developer", task: "task" },
        context,
      );

      expect(result.success).toBe(true);
    });
  });
});
