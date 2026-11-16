# Optimize Performance

> *Fast, cheap, and reliable. Production agents need all three. Agenthood routes to all three.*

---

## What it is

Agent performance has three axes, and optimizing one usually costs you another. **Speed** is latency, from the first action to completion. **Cost** is tokens, measured in provider fees per run. **Reliability** is uptime: what happens when a provider rate-limits you, goes down or returns a degraded response. The three pull against each other: the fastest model is not always the cheapest, and the cheapest is not always the most reliable.

Three levers move those axes: routing, failover and observability. **Routing** matches the model to the query, so a formatting task does not pay for the model a debugging task needs. **Failover** keeps the agent running when a provider fails: if Groq is down, fall back to OpenAI, and if OpenAI is down, fall back to a local model. **Observability** exposes cost per request, so a token regression is caught before the invoice arrives.

Without them, every request goes to the same model at the same provider, and you accept whatever latency, cost and uptime follow from that choice. At demo scale that is fine. At production scale it is a budget drain and a scheduled outage.

---

## Why it matters in production

At scale, every unnecessary call to the most expensive model is a line item. An agent that routes "write a commit message" to a 70B-parameter model is spending 10x what it should: the task does not need that capability. Multiplied across thousands of runs per day, the overspend is the difference between an agent that is sustainable to operate and one that gets disabled when the invoice arrives.

The reliability problem is more visible because it produces incidents. A single-provider agent goes down when the provider goes down, and every LLM provider has outages. An agent without failover becomes a hard dependency on one provider's uptime, which is a dependency you do not control. Provider failover turns a provider outage from "our agents are down" into "our agents are slower for 10 minutes while we fail over."

Cost visibility is the silent one. A change to a prompt that adds 500 tokens per call does not break anything: the agent still works. But at 10,000 calls per day, that change adds 5 million tokens per day to the bill. `CostEstimator` makes this visible per request, so a token regression is a detected regression, not a surprise on the monthly invoice.

---

## How Agenthood implements it

The three axes are covered by `LLMRouter` (`src/llm/`), `ProviderFailover` (`src/core/`) and `CostEstimator` (`src/evals/`). `EpisodeLearner` (index-backed), `EvalRunner` and the anomaly detector (wired into trace flush) shipped in the same release:

```typescript
import { LLMRouter, ProviderFailover, CostEstimator } from 'agenthood';

// 1. Dynamic routing: match model capability to query complexity
const router = new LLMRouter({
  rules: [
    { match: { complexity: 'low',  task: /commit|format|summarize/i }, provider: 'groq',    model: 'llama-3.1-8b-instant' },
    { match: { complexity: 'high', task: /debug|architect|review/i   }, provider: 'groq',    model: 'llama-3.3-70b-versatile' },
    { match: { complexity: 'high', task: /security|audit/i           }, provider: 'openai',  model: 'gpt-5.4' },
  ],
});

// 2. Provider failover: keep running when a provider goes down
const failover = new ProviderFailover({
  chain: ['groq', 'openai', 'ollama-local'],
  retryPolicy: { retries: 2, backoff: 'exponential' },
});

// 3. Cost visibility: track tokens and cost per request
const costEstimator = new CostEstimator({
  pricing: {
    'groq:llama-3.1-8b-instant':    { input: 0.05,  output: 0.08  },  // per 1M tokens
    'groq:llama-3.3-70b-versatile': { input: 0.59,  output: 0.99  },
    'openai:gpt-5.4':                { input: 2.50,  output: 15.00 },
  },
});

// Composed into the agent's LLM layer
const llm = router.withFailover(failover).withCostTracking(costEstimator);
const response = await llm.complete({ system, user });
// response.cost = { inputTokens: 320, outputTokens: 180, totalCost: 0.00041 }
```

The `LLMRouter` inspects each request and routes it to the model whose capability matches the task. `ProviderFailover` wraps every call: when the primary provider returns a 5xx or times out, the call retries on the next provider in the chain. `CostEstimator` attaches a cost record to every response, so the run log shows what the agent did and what it cost.

---

## Hands-on example

```bash
# The Society's runtime reports cost alongside the result
agenthood run scribe "write a commit message for the current diff"
```

Output with cost visibility:

```
[route] task: commit message → complexity: low → groq:llama-3.1-8b-instant
[act]   llm.complete(...)
[see]   "feat(auth): add OAuth2 login to API middleware"
[cost]  input: 412 tokens, output: 18 tokens, total: $0.00003
[done]  Commit message generated. Total run cost: $0.00003
```

Contrast with the same task routed without the router, to a 70B model by default:

```
[act]   llm.complete(...)
[see]   "feat(auth): add OAuth2 login to API middleware"
[cost]  input: 412 tokens, output: 18 tokens, total: $0.00029  ← 10x more expensive
```

Same output, 10x the cost. The router's job is to make sure that does not happen by default.

When a provider fails, the failover chain fires:

```
[route] task: code review → complexity: high → groq:llama-3.3-70b-versatile
[act]   llm.complete(...)
[fail]  groq: 503 Service Unavailable
[retry] failover → openai:gpt-5.4
[act]   llm.complete(...)
[see]   "Approved: 0 blockers, 2 nits"
[cost]  input: 1840 tokens, output: 92 tokens, total: $0.00550
[done]  Review complete via failover (groq → openai). Cost: $0.00550
```

The agent stayed running. The user saw a result, not an error.

---

## Further reading

- [`src/llm/LLMRouter.ts`](../../../src/llm/LLMRouter.ts): dynamic routing (v2.0.0)
- [`src/llm/ProviderFailover.ts`](../../../src/llm/ProviderFailover.ts): provider failover chain (v2.0.0)
- [Artificial Analysis](https://artificialanalysis.ai/): live LLM pricing and performance benchmarks


