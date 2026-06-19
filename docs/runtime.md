# Agenthood Runtime Documentation

**Version**: M4 Foundation  
**Last Updated**: 2026-06-19

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. **Additional Documentation**
   - [Developer Guide](./runtime-guide.md) - Core concepts, creating custom skills/agents, configuration
   - [API Reference](./runtime-api.md) - Complete API documentation and advanced topics
   - [Troubleshooting & Examples](./runtime-troubleshooting.md) - Common issues and practical examples

---

## Overview

The Agenthood TypeScript runtime is a **production-ready autonomous agent framework** that implements:

- **Multi-provider LLM abstraction** - Works with Groq, OpenAI, Anthropic, Ollama
- **ReAct reasoning loop** - Think → Act → Observe cycles
- **Tool-calling architecture** - Agents use skills via function calling
- **Extensible skill system** - Create custom tools for your agents
- **Type-safe TypeScript** - Full type safety throughout

**Philosophy**: Agents are composed of **skills** (what they can do) and **reasoning** (how they think). The runtime provides both.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          CLI / API                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
             ┌─────────▼─────────┐
             │   BaseAgent       │
             │  (DeveloperAgent) │
             └─────────┬─────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
  ┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
  │ ReActLoop │  │  Skills │  │ LLMProvider │
  └─────┬─────┘  └────┬────┘  └──────┬──────┘
        │              │              │
        │      ┌───────▼────────┐     │
        │      │ SkillRegistry  │     │
        │      └───────┬────────┘     │
        │              │              │
        └──────────────┼──────────────┘
                       │
              ┌────────▼─────────┐
              │ ExecutionContext │
              └──────────────────┘
```

### Key Components

| Component | Responsibility |
|-----------|----------------|
| **BaseAgent** | Orchestrates skills and reasoning for a specific role |
| **ReActLoop** | Implements the Reason → Act → Observe cycle |
| **SkillRegistry** | Manages available tools and provides schemas to LLM |
| **ILLMProvider** | Abstraction over Groq/OpenAI/Anthropic/Ollama APIs |
| **ExecutionContext** | Shared state across a single agent execution |

---

## Quick Start

### Installation

```bash
npm install agenthood
```

### Set up your API key

```bash
# Groq (default, free tier available)
# Set GROQ_API_KEY in your environment (free at console.groq.com)

# Or use OpenAI
# Set OPENAI_API_KEY in your environment

# Or run locally with Ollama (no key needed)
# Download from: https://ollama.com
```

### Run a built-in agent

```bash
# Using the CLI
agenthood run developer "refactor the login function"

# Or programmatically
import { DeveloperAgent } from 'agenthood/agents'
import { LLMRouter } from 'agenthood/llm'

const llm = LLMRouter.create({ provider: 'groq' })
const agent = new DeveloperAgent(llm)

const result = await agent.run("refactor the login function", context)
console.log(result.output)
```

---

## Next Steps

- **[Developer Guide](./runtime-guide.md)** - Learn core concepts and how to create custom skills and agents
- **[API Reference](./runtime-api.md)** - Complete interface documentation
- **[Troubleshooting & Examples](./runtime-troubleshooting.md)** - Solve common issues and see practical examples

---

**For questions or issues:**
- [GitHub Issues](https://github.com/fworks-tech/agenthood/issues)
- [Architecture Docs](../architecture/README.md)
- [ADRs](./adr/)
