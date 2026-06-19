# Agenthood Runtime - Developer Guide

Complete guide to understanding and extending the Agenthood runtime.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Creating Custom Skills](#creating-custom-skills)
3. [Creating Custom Agents](#creating-custom-agents)
4. [Configuration](#configuration)
5. [LLM Providers](#llm-providers)

---

## Core Concepts

### 1. Skills (Tools)

Skills are **functions that agents can call**. Each skill has:
- A `name` (what the LLM requests)
- A `description` (when to use it)
- An `inputSchema` (what arguments it accepts)
- An `execute()` method (what it does)

Example: `ReadFileSkill` lets agents read files from the project.

### 2. Agents

Agents are **roles with specific skills and reasoning**. Each agent has:
- A `role` (e.g., "developer", "reviewer")
- A set of `skills` it can use
- A `systemPrompt` that defines its behavior

Example: `DeveloperAgent` has skills for reading/writing code.

### 3. ReAct Loop

The **Reason → Act → Observe** cycle:

1. **Reason**: LLM thinks about what to do next
2. **Act**: LLM requests a tool call (skill execution)
3. **Observe**: Tool result is fed back to LLM
4. **Repeat** until task is complete

This continues until the LLM decides no more tools are needed.

### 4. Execution Context

Shared state for a single agent run:
- **Memory**: Short-term, long-term, episodic, project
- **LLM**: The language model provider
- **Tracer**: Observability for debugging
- **Artifacts**: Files, data produced during execution

---

## Creating Custom Skills

### Step 1: Define the skill interface

```typescript
import { ISkill, SkillResult, ExecutionContext } from 'agenthood/skills'
import { JSONSchema } from 'agenthood/llm'

export class WeatherSkill implements ISkill {
  name = 'get_weather'
  description = 'Get current weather for a city'
  
  inputSchema: JSONSchema = {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
      units: { type: 'string', description: 'celsius or fahrenheit' }
    },
    required: ['city']
  }
  
  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { city, units = 'celsius' } = input as { city: string; units?: string }
    
    try {
      // Your implementation here
      const weather = await fetchWeather(city, units)
      
      return {
        success: true,
        output: `Weather in ${city}: ${weather.temp}°${units === 'celsius' ? 'C' : 'F'}`
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
```

### Step 2: Register the skill

```typescript
import { SkillRegistry } from 'agenthood/skills'

const registry = new SkillRegistry()
registry.register(new WeatherSkill())
```

### Step 3: Use in an agent

```typescript
export class WeatherAgent extends BaseAgent {
  role = 'weather_assistant'
  
  protected skills = [
    new WeatherSkill(),
    new SearchSkill() // Add more skills
  ]
  
  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    return 'You are a helpful weather assistant. Use the get_weather tool to answer questions.'
  }
}
```

---

## Creating Custom Agents

### Minimal Agent Example

```typescript
import { BaseAgent } from 'agenthood/agents'
import { ISkill } from 'agenthood/skills'
import { ExecutionContext } from 'agenthood/core'

export class MyAgent extends BaseAgent {
  // Required: Define the agent's role
  role = 'my_agent'
  
  // Required: List of skills this agent can use
  protected skills: ISkill[] = [
    new ReadFileSkill(),
    new WriteFileSkill(),
    // Add your custom skills
  ]
  
  // Required: System prompt that defines behavior
  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    return `You are a helpful assistant. You can read and write files.
    
Current project: ${context.project.name}

Always explain what you're doing before using a tool.`
  }
}
```

### Running Your Agent

```typescript
import { LLMRouter } from 'agenthood/llm'
import { createExecutionContext } from 'agenthood/core'

// Create LLM provider
const llm = LLMRouter.create({ provider: 'groq' })

// Create agent
const agent = new MyAgent(llm, new ReActLoop(llm, registry), registry)

// Create execution context
const context = createExecutionContext({
  project: { name: 'my-project', root: '/path/to/project' },
  llm
})

// Run the agent
const result = await agent.run('Refactor the utils.ts file', context)
console.log(result.output)
```

---

## Configuration

### Environment Variables

```bash
# LLM Provider API Keys
# GROQ_API_KEY              # Groq (default) - get at console.groq.com
# OPENAI_API_KEY            # OpenAI
# ANTHROPIC_API_KEY         # Anthropic
# Ollama runs locally, no key needed

# Model Selection (optional)
GROQ_DEFAULT_MODEL=llama-3.1-70b-versatile
OPENAI_DEFAULT_MODEL=gpt-4o
ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-20241022
OLLAMA_DEFAULT_MODEL=llama3

# Runtime Configuration (optional)
MAX_REASONING_STEPS=10         # Default thinking budget
```

### Programmatic Configuration

```typescript
import { LLMRouter } from 'agenthood/llm'

// Option 1: Use environment variables
const llm = LLMRouter.create({ provider: 'groq' })

// Option 2: Explicit configuration
const llm = LLMRouter.create({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20241022',
  apiKey: 'sk-ant-...'
})

// Option 3: Local Ollama (no API key)
const llm = LLMRouter.create({
  provider: 'ollama',
  model: 'llama3',
  baseUrl: 'http://localhost:11434'
})
```

---

## LLM Providers

### Supported Providers

| Provider | Cost | Speed | Use Case |
|----------|------|-------|----------|
| **Groq** | Free tier | Very fast (< 100ms) | Default, development |
| **Anthropic** | Paid | Fast | Production, complex reasoning |
| **OpenAI** | Paid | Medium | Production, general use |
| **Ollama** | Free | Medium | Local, offline, privacy |

### Provider-Specific Features

#### Groq
```typescript
const llm = LLMRouter.create({
  provider: 'groq',
  model: 'llama-3.1-70b-versatile' // or mixtral-8x7b-32768
})
```
- **Pros**: Free, extremely fast inference
- **Cons**: Rate limits on free tier
- **Best for**: Development, prototyping

#### Anthropic (Claude)
```typescript
const llm = LLMRouter.create({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20241022'
})
```
- **Pros**: Best reasoning, long context (200k tokens)
- **Cons**: Paid only
- **Best for**: Production, complex tasks

#### OpenAI (GPT)
```typescript
const llm = LLMRouter.create({
  provider: 'openai',
  model: 'gpt-4o'
})
```
- **Pros**: Good balance, widely supported
- **Cons**: Paid, slower than Groq
- **Best for**: Production, general use

#### Ollama (Local)
```typescript
const llm = LLMRouter.create({
  provider: 'ollama',
  model: 'llama3'
})
```
- **Pros**: Free, private, offline-capable
- **Cons**: Requires local setup, slower
- **Best for**: Privacy-sensitive work, offline

---

**Next:**
- [API Reference](./runtime-api.md) - Complete interface documentation
- [Troubleshooting & Examples](./runtime-troubleshooting.md) - Common issues and practical examples
