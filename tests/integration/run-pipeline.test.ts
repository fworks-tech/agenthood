import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReActLoop } from '../../src/reasoning/ReActLoop.ts';
import { ToolRegistry } from '../../src/tools/ToolRegistry.ts';
import {
  StubProvider,
  STUB_PROVIDER_ENV,
} from '../../src/llm/providers/StubProvider.ts';
import { createTestContext } from '../helpers/testContext.ts';
import type { ITool, ToolResult } from '../../src/tools/ITool.ts';
import type { ExecutionContext } from '../../src/core/ExecutionContext.ts';

// StubProvider is test-only and refuses to construct without this gate (#639).
process.env[STUB_PROVIDER_ENV] = '1';

/** A real, deterministic tool so the loop exercises actual execution, not a mock. */
class EchoTool implements ITool {
  name = 'echo';
  description = 'Echoes its input';
  inputSchema = {
    type: 'object',
    properties: { msg: { type: 'string' } },
    required: ['msg'],
  };
  async execute(input: unknown): Promise<ToolResult> {
    const { msg } = input as { msg: string };
    return { success: true, output: `echo:${msg}` };
  }
}

function buildLoop(): { loop: ReActLoop; llm: StubProvider; context: ExecutionContext } {
  const llm = new StubProvider({});
  const registry = new ToolRegistry();
  registry.register(new EchoTool());
  return { loop: new ReActLoop(llm, registry), llm, context: createTestContext() };
}

describe('run pipeline integration (StubProvider → ReActLoop → tool → back)', () => {
  const recorded: string[] = [];
  let capture: (() => void) | undefined;

  beforeEach(() => {
    StubProvider.resetScript();
    recorded.length = 0;
  });

  afterEach(() => {
    capture?.();
    capture = undefined;
  });

  it('completes a two-step run and returns the final assistant content', async () => {
    const { loop, context } = buildLoop();
    StubProvider.enqueueScript([{ toolCalls: [{ id: 'c1', name: 'echo', args: { msg: 'hi' } }] }, { content: 'DONE' }]);

    const output = await loop.run('system prompt', 'say hi', context);
    expect(output).toBe('DONE');
  });

  it('feeds the tool result back to the LLM on the next step', async () => {
    const { loop, llm, context } = buildLoop();
    const spy = vi.spyOn(llm, 'complete');
    StubProvider.enqueueScript([{ toolCalls: [{ id: 'c1', name: 'echo', args: { msg: 'hi' } }] }, { content: 'DONE' }]);

    await loop.run('system prompt', 'say hi', context);

    expect(spy).toHaveBeenCalledTimes(2);
    // The 2nd LLM call must carry the executed tool output so the model can react.
    const secondCallMessages = spy.mock.calls[1][0].messages;
    const serialized = JSON.stringify(secondCallMessages);
    expect(serialized).toContain('echo:hi');
    expect(secondCallMessages.some((m) => m.role === 'tool')).toBe(true);
  });

  it('emits ordered tool.called → tool.result lifecycle events with the tool output', async () => {
    const { loop, context } = buildLoop();
    capture = context.events.subscribe((e) => {
      if (e.type === 'tool.called' || e.type === 'tool.result') recorded.push(e.type);
    });
    StubProvider.enqueueScript([{ toolCalls: [{ id: 'c1', name: 'echo', args: { msg: 'hi' } }] }, { content: 'DONE' }]);

    await loop.run('system prompt', 'say hi', context);

    expect(recorded).toEqual(['tool.called', 'tool.result']);
  });

  it('surfaces a tool error to the model instead of throwing', async () => {
    const llm = new StubProvider({});
    const registry = new ToolRegistry();
    class BoomTool implements ITool {
      name = 'boom';
      description = 'always fails';
      inputSchema = { type: 'object', properties: {}, required: [] };
      async execute(): Promise<ToolResult> {
        return { success: false, output: '', error: 'kaboom' };
      }
    }
    registry.register(new BoomTool());
    const loop = new ReActLoop(llm, registry);
    const spy = vi.spyOn(llm, 'complete');
    StubProvider.enqueueScript([{ toolCalls: [{ id: 'c1', name: 'boom', args: {} }] }, { content: 'recovered' }]);

    const context = createTestContext();
    const output = await loop.run('sys', 'go', context);
    expect(output).toBe('recovered');
    // the failed tool produced an Error message that was fed back, not thrown
    expect(JSON.stringify(spy.mock.calls[1][0].messages)).toContain('kaboom');
  });

  it('does not trip the safety limit on a normal short run', async () => {
    const { loop, context } = buildLoop();
    StubProvider.enqueueScript([{ toolCalls: [{ id: 'c1', name: 'echo', args: { msg: 'hi' } }] }, { content: 'DONE' }]);
    await expect(loop.run('sys', 'go', context)).resolves.toBe('DONE');
  });
});
