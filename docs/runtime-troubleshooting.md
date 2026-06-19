# Agenthood Runtime - Troubleshooting & Examples

Common issues and practical examples for the Agenthood runtime.

---

## Table of Contents

1. [Troubleshooting](#troubleshooting)
2. [Examples](#examples)

---

## Troubleshooting

### "GROQ_API_KEY is not set"

**Cause**: Missing environment variable.

**Fix**: Set GROQ_API_KEY in your shell environment.

Get a free key at [console.groq.com](https://console.groq.com).

### "Model not found" or "Invalid model"

**Cause**: Model name doesn't exist for the provider.

**Fix**: Check supported models:

```typescript
// Groq
'llama-3.1-70b-versatile'  // ✅
'llama-3.1-8b-instant'     // ✅
'mixtral-8x7b-32768'       // ✅

// OpenAI
'gpt-4o'                   // ✅
'gpt-4-turbo'              // ✅

// Anthropic
'claude-sonnet-4-20241022' // ✅
'claude-opus-4-20241022'   // ✅
```

### Rate limit errors

**Cause**: Groq free tier has rate limits (30 req/min).

**Fix options**:
1. Wait 60 seconds and retry
2. Use a paid provider (OpenAI/Anthropic)
3. Use Ollama locally (no limits)

### Tool calls not working

**Cause**: Not all providers support tool calling equally.

**Fix**: Use a provider with good tool support:
- Groq (llama-3.1-70b) ✅ Excellent
- OpenAI (gpt-4o) ✅ Excellent
- Anthropic (claude-sonnet-4) ✅ Excellent
- Ollama ⚠️ Limited (depends on model)

### "Cannot find module" errors

**Cause**: TypeScript paths not resolved correctly.

**Fix**: Ensure your `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true
  }
}
```

### Agent runs out of thinking budget

**Cause**: Task requires more reasoning steps than the default limit (10).

**Fix**: Increase the budget via environment variable:
```bash
MAX_REASONING_STEPS=20
```

Or programmatically:
```typescript
const budget = new ThinkingBudget(20)
```

### Schema validation errors

**Cause**: Tool arguments don't match the `inputSchema`.

**Fix**: Check the error message for which property failed validation:
```
Missing required property: path
Property "count" must be number, got string
```

Update your tool call to match the expected schema.

---

## Examples

### Example 1: File Refactoring Agent

```typescript
import { DeveloperAgent } from 'agenthood/agents'
import { LLMRouter } from 'agenthood/llm'
import { createExecutionContext } from 'agenthood/core'

const llm = LLMRouter.create({ provider: 'groq' })
const agent = new DeveloperAgent(llm)

const context = createExecutionContext({
  project: { name: 'my-app', root: process.cwd() },
  llm
})

const result = await agent.run(
  'Refactor src/utils.ts to use modern ES6 syntax',
  context
)

console.log(result.output)
// Output: "I've refactored utils.ts to use arrow functions, const/let, 
//          and template literals. Changes written to the file."
```

### Example 2: Multi-Step Analysis

```typescript
const result = await agent.run(
  'Analyze the login.ts file and suggest security improvements',
  context
)

// Agent will:
// 1. Read login.ts (ReadFileSkill)
// 2. Analyze code for security issues
// 3. Write recommendations to security-audit.md (WriteFileSkill)
```

### Example 3: Custom Weather Agent

```typescript
import { BaseAgent } from 'agenthood/agents'
import { ExecutionContext } from 'agenthood/core'

class WeatherAgent extends BaseAgent {
  role = 'weather_assistant'
  
  protected skills = [new WeatherSkill()]
  
  protected async getSystemPrompt(ctx: ExecutionContext) {
    return 'You help users check weather. Use get_weather tool when asked about weather.'
  }
}

const llm = LLMRouter.create({ provider: 'groq' })
const agent = new WeatherAgent(llm, new ReActLoop(llm, registry), registry)
const result = await agent.run('What is the weather in London?', context)

console.log(result.output)
// Output: "Weather in London: 15°C, partly cloudy"
```

### Example 4: Streaming Responses

```typescript
const llm = LLMRouter.create({ provider: 'groq' })

const stream = await llm.stream({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Explain TypeScript in 3 sentences' }
  ]
})

for await (const chunk of stream) {
  if (!chunk.done) {
    process.stdout.write(chunk.delta)
  }
}
```

### Example 5: Custom Skill with External API

```typescript
import { ISkill, SkillResult, ExecutionContext } from 'agenthood/skills'
import { JSONSchema } from 'agenthood/llm'

export class GitHubSearchSkill implements ISkill {
  name = 'search_github'
  description = 'Search GitHub repositories'
  
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      language: { type: 'string', description: 'Programming language filter' }
    },
    required: ['query']
  }
  
  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { query, language } = input as { query: string; language?: string }
    
    try {
      const searchQuery = language ? `${query} language:${language}` : query
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()
      
      const results = data.items.slice(0, 5).map((repo: any) => 
        `${repo.full_name} - ${repo.description} (⭐ ${repo.stargazers_count})`
      ).join('\n')
      
      return {
        success: true,
        output: `Top GitHub repositories:\n${results}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API request failed'
      }
    }
  }
}
```

### Example 6: Multi-Agent Collaboration

```typescript
// Create specialized agents
const reviewerAgent = new ReviewerAgent(llm)
const testerAgent = new TesterAgent(llm)

// Developer writes code
const devResult = await developerAgent.run(
  'Implement a login function in src/auth.ts',
  context
)

// Reviewer checks the code
const reviewResult = await reviewerAgent.run(
  'Review the changes in src/auth.ts',
  context
)

// Tester adds tests
const testResult = await testerAgent.run(
  'Write tests for the login function in src/auth.ts',
  context
)

console.log('Development complete!')
console.log('Review:', reviewResult.output)
console.log('Tests:', testResult.output)
```

### Example 7: Error Recovery

```typescript
const agent = new DeveloperAgent(llm)

try {
  const result = await agent.run('Read config.json', context)
  console.log(result.output)
} catch (error) {
  if (error.message.includes('ENOENT')) {
    // File doesn't exist - create it
    await agent.run('Create a default config.json file', context)
  } else {
    throw error
  }
}
```

### Example 8: Configuring LLM Parameters

```typescript
const llm = LLMRouter.create({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20241022'
})

const response = await llm.complete({
  messages: [
    { role: 'user', content: 'Generate creative project names' }
  ],
  temperature: 0.9,      // Higher temperature = more creative
  maxTokens: 200,        // Limit response length
  topP: 0.95             // Nucleus sampling
})
```

---

**See also:**
- [Main Documentation](./runtime.md) - Overview and quick start
- [Developer Guide](./runtime-guide.md) - Core concepts and customization
- [API Reference](./runtime-api.md) - Complete interface documentation
