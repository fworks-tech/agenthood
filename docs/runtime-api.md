# Agenthood Runtime - API Reference

Complete API documentation for the Agenthood runtime.

---

## Table of Contents

1. [ISkill Interface](#iskill-interface)
2. [BaseAgent Class](#baseagent-class)
3. [ILLMProvider Interface](#illmprovider-interface)
4. [ExecutionContext Interface](#executioncontext-interface)
5. [Advanced Topics](#advanced-topics)

---

## ISkill Interface

Skills are tools that agents can invoke during execution.

```typescript
interface ISkill {
  name: string                 // Tool name for LLM
  description: string          // When to use this tool
  inputSchema: JSONSchema      // Argument validation schema
  
  execute(
    input: unknown,
    context: ExecutionContext
  ): Promise<SkillResult>
}

interface SkillResult {
  success: boolean             // Did it work?
  output: string               // Result message
  artifacts?: Artifact[]       // Files/data produced
  error?: string               // Error message if failed
}
```

### Example Implementation

```typescript
export class ReadFileSkill implements ISkill {
  name = 'read_file'
  description = 'Read contents of a file from the project'
  
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to project root' }
    },
    required: ['path']
  }
  
  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { path } = input as { path: string }
    
    try {
      const content = await fs.readFile(path, 'utf-8')
      return { success: true, output: content }
    } catch (error) {
      return {
        success: false,
        error: `Failed to read ${path}: ${error.message}`
      }
    }
  }
}
```

---

## BaseAgent Class

Abstract base class for all agents.

```typescript
abstract class BaseAgent {
  abstract role: string                          // Agent identifier
  protected abstract skills: ISkill[]            // Available tools
  protected abstract getSystemPrompt(
    context: ExecutionContext
  ): Promise<string>
  
  async run(
    input: string,
    context: ExecutionContext
  ): Promise<AgentResult>
}

interface AgentResult {
  role: string                 // Agent that produced this
  output: string               // Final response
  artifacts: Artifact[]        // Files/data produced
}
```

### Example Implementation

```typescript
export class DeveloperAgent extends BaseAgent {
  role = 'developer'
  
  protected skills: ISkill[] = [
    new ReadFileSkill(),
    new WriteFileSkill(),
    new SearchCodeSkill(),
    new RunCommandSkill()
  ]
  
  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    return `You are a senior software engineer working on ${context.project.name}.

Available tools:
- read_file: Read any file from the project
- write_file: Create or update files
- search_code: Find code patterns across the project
- run_command: Execute shell commands

Follow these principles:
1. Read before you write
2. Test changes when possible
3. Write clear, maintainable code
4. Explain your decisions`
  }
}
```

---

## ILLMProvider Interface

Abstraction over different LLM providers.

```typescript
interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>
  stream(request: LLMRequest): Promise<AsyncGenerator<LLMChunk>>
  embed(text: string): Promise<number[]>
}

interface LLMRequest {
  messages: Message[]          // Conversation history
  tools?: ToolSchema[]         // Available functions
  temperature?: number         // Randomness (0-1)
  maxTokens?: number           // Response length limit
}

interface LLMResponse {
  content: string              // LLM's text response
  toolCalls?: ToolCall[]       // Requested function calls
  usage: TokenUsage            // Token counts
  model: string                // Model that responded
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string                // For tool messages
  toolCalls?: ToolCall[]       // For assistant messages
}

interface ToolCall {
  id: string                   // Unique call ID
  name: string                 // Skill name
  args: Record<string, unknown>// Arguments
}

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}
```

### Example Usage

```typescript
import { GroqProvider } from 'agenthood/llm/providers'

const provider = new GroqProvider({
  model: 'llama-3.1-70b-versatile'
})

const response = await provider.complete({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is TypeScript?' }
  ],
  temperature: 0.7,
  maxTokens: 500
})

console.log(response.content)
console.log(`Used ${response.usage.totalTokens} tokens`)
```

---

## ExecutionContext Interface

Shared state for a single agent execution.

```typescript
interface ExecutionContext {
  executionId: string          // Unique run ID
  project: Project             // Project metadata
  memory: {
    shortTerm: ShortTermMemory // Current conversation
    longTerm: LongTermMemory   // Persistent knowledge
    episodic: EpisodicMemory   // Past experiences
    project: ProjectMemory     // Project-specific data
  }
  llm: ILLMProvider            // Language model
  prompts: PromptBuilder       // Template system
  tracer: Tracer               // Observability
  artifacts: Artifact[]        // Output collection
}

interface Project {
  name: string                 // Project name
  root: string                 // Root directory path
  config?: AgentConfig         // Optional configuration
}
```

### Creating Context

```typescript
import { createExecutionContext } from 'agenthood/core'

const context = createExecutionContext({
  project: {
    name: 'my-app',
    root: process.cwd()
  },
  llm: LLMRouter.create({ provider: 'groq' })
})
```

---

## Advanced Topics

### Schema Validation

The runtime automatically validates tool arguments against `inputSchema` before execution:

```typescript
const skill = new ReadFileSkill()

// Valid call
await skill.execute({ path: 'src/index.ts' }, context)
// ✅ Success

// Missing required argument
await skill.execute({}, context)
// ❌ Error: "Missing required property: path"

// Wrong type
await skill.execute({ path: 123 }, context)
// ❌ Error: 'Property "path" must be string, got number'
```

**How it works**:
1. Agent requests a tool call
2. Runtime validates arguments against `inputSchema`
3. If valid → skill executes
4. If invalid → error returned to agent, no execution

This prevents runtime errors and helps the LLM self-correct.

### Thinking Budget

The `ThinkingBudget` prevents infinite loops by limiting reasoning steps:

```typescript
const budget = new ThinkingBudget(10) // Max 10 reasoning steps

// Each tool call consumes budget
budget.consume() // 9 remaining
budget.consume() // 8 remaining

// When exhausted
budget.hasCapacity() // false
// Agent must return final answer
```

Configure via environment:
```bash
MAX_REASONING_STEPS=20  # Allow deeper reasoning
```

### Tool Schemas

Tool schemas follow JSON Schema format:

```typescript
const schema: JSONSchema = {
  type: 'object',
  properties: {
    required_field: {
      type: 'string',
      description: 'This field is required'
    },
    optional_field: {
      type: 'number',
      description: 'This field is optional',
      default: 42
    },
    enum_field: {
      type: 'string',
      enum: ['option1', 'option2', 'option3'],
      description: 'Must be one of the listed values'
    }
  },
  required: ['required_field']
}
```

### Error Handling

Skills should return structured errors, not throw:

```typescript
async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
  try {
    const result = await someOperation(input)
    return { success: true, output: result }
  } catch (error) {
    // Don't throw - return error result
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

---

**Next:**
- [Troubleshooting & Examples](./runtime-troubleshooting.md) - Common issues and practical examples
- [Main Documentation](./runtime.md) - Overview and quick start
