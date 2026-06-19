# Spec: Provider Failover with Circuit Breaker

**Status:** Proposed  
**Issue:** #161  
**Architecture Doc:** [architecture/provider-failover.md](../../architecture/provider-failover.md)

---

## Problem

The Agenthood runtime currently depends on a single LLM provider per execution. When that provider fails—due to rate limits, temporary outages, or authentication issues—the entire member execution fails and the task is interrupted.

This creates poor production reliability:
- **Groq rate limits** (30 req/min free tier) kill sessions during burst activity
- **Provider outages** halt all member work, even though alternative providers are available
- **Intermittent failures** force manual retry from humans instead of automated recovery
- **No retry logic** means transient network blips cause permanent task failure

The user expects the Society to handle provider fragility transparently. If Claude is down, use Gemini. If Groq hits rate limits, switch to Ollama. The member should continue working—the human should never notice the plumbing.

---

## Proposed Solution

Implement a **three-phase progressive enhancement** to provider resilience:

### Phase 1: Basic Failover (MVP)
Try each configured provider in sequence until one succeeds or all fail.

**Behavior:**
- Load provider chain from `.agenthood/config.json` (`llm.providers[]`)
- Attempt providers in order: `[primary, fallback1, fallback2, ...]`
- On failure, immediately try the next provider
- If all providers fail, throw `AllProvidersFailedError` with structured failure details

**No circuit breaker yet**—this is a simple try/catch loop with failover.

**Acceptance Criteria:**
- Provider chain loaded from config
- Each provider attempted in sequence
- First success stops the chain and returns result
- All failures collected and reported in `AllProvidersFailedError`
- Existing member execution flow unchanged (transparent drop-in)

---

### Phase 2: Circuit Breaker
Track provider health and skip known-bad providers.

**Behavior:**
- Each provider has a circuit state: `CLOSED` | `OPEN` | `HALF_OPEN`
- **CLOSED:** Normal operation—requests flow through
- **OPEN:** Provider bypassed (failures exceeded threshold)—skip to next provider
- **HALF_OPEN:** Cooldown expired—one probe request allowed to test recovery

**State Transitions:**
```
CLOSED → (N failures within window) → OPEN
OPEN → (cooldown expires) → HALF_OPEN
HALF_OPEN → (probe succeeds) → CLOSED
HALF_OPEN → (probe fails) → OPEN (extend cooldown)
```

**Configuration:**
```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;      // default: 3 failures
  failureWindow: number;          // default: 60 seconds
  cooldownDuration: number;       // default: 120 seconds
  probeBeforeCooldown: number;    // default: 30 seconds before cooldown expires
}
```

**Acceptance Criteria:**
- Circuit state tracked per provider
- Providers in `OPEN` state are skipped during failover
- Circuit opens after N failures within time window
- Circuit transitions to `HALF_OPEN` after cooldown
- Probe request succeeds → circuit closes → provider restored
- Probe request fails → circuit re-opens with extended cooldown
- Circuit state logged (debug level) on every transition
- Thread execution continues across provider switches

---

### Phase 3: Advanced Recovery
Intelligent failure handling with classification, cooldown strategies, and preemptive probes.

**Behavior:**

#### 3.1 Failure Classification
Not all failures are equal. Classify errors and apply appropriate cooldown:

| HTTP Status | Classification | Cooldown | Behavior |
|-------------|---------------|----------|----------|
| `401` | Auth failure | Permanent | Skip provider, log warning once |
| `402` | Payment required | Permanent | Skip provider, log warning once |
| `429` | Rate limited | 60–300s | Backoff based on `Retry-After` header |
| `408` | Request timeout | 30s | Retry once, then failover |
| `503` | Service unavailable | 60s | Immediate failover |
| `404` | Model not found | Permanent | Skip provider, log error |
| Network error | Transient | 30s | Retry with exponential backoff |

#### 3.2 Retry-After Header Parsing
If a provider returns `429` with a `Retry-After` header:
- Parse the header (seconds or HTTP date)
- Set cooldown to `Retry-After` value (capped at 5 minutes)
- Log the retry time to user

#### 3.3 Preemptive Probe Recovery
Send a lightweight probe request **30 seconds before cooldown expires**:
- Use a minimal prompt (e.g., "Hello")
- On success → provider restored early
- On failure → cooldown extended by 50%

Prevents hammering a recovering provider with full-sized requests.

#### 3.4 Exponential Backoff for Transient Failures
For network errors and timeouts:
- First retry: immediate
- Second retry: 2 seconds delay
- Third retry: 4 seconds delay
- After 3 retries: failover to next provider

**Acceptance Criteria:**
- HTTP status codes classified correctly
- Permanent failures skip provider without cooldown
- Rate limit failures parse `Retry-After` header
- Cooldown durations set per failure classification
- Probe request sent 30s before cooldown expiry
- Probe success restores provider early
- Exponential backoff applies to transient network failures
- All failure details logged (error level) with classification
- Metrics collected: provider health, failure counts, recovery times

---

## Out of Scope

The following are explicitly **NOT included** in this spec:

- **Credential proxy** — API key injection via localhost proxy (separate feature)
- **Member-level provider preferences** — The Scribe prefers Claude, The Doorman prefers Groq (future enhancement)
- **Model downgrade** — Switching from Claude Opus to Claude Sonnet on the same provider (future enhancement)
- **Thread checkpoint** — Persisting conversation state for cross-provider continuity (separate feature, may not be needed)
- **Provider cost tracking** — Monitoring token usage and costs per provider (separate feature)
- **Human escalation UI** — Interactive prompt to choose fallback provider when all fail (future enhancement)

These may be addressed in future specs but are not part of this implementation.

---

## Testing Strategy

### Unit Tests
**Location:** `src/llm/providerFailover.test.ts`

Test cases:
- ✅ Single provider success (no failover)
- ✅ First provider fails → second succeeds
- ✅ All providers fail → AllProvidersFailedError thrown
- ✅ Circuit opens after N failures
- ✅ Circuit transitions to HALF_OPEN after cooldown
- ✅ Probe success closes circuit
- ✅ Probe failure re-opens circuit
- ✅ Permanent failure (401) skips provider without cooldown
- ✅ Rate limit (429) applies Retry-After cooldown
- ✅ Transient failure applies exponential backoff
- ✅ Probe request sent 30s before cooldown expiry
- ✅ Empty provider chain throws immediately

**Coverage target:** 95%+ (critical path for production reliability)

### Integration Tests
**Location:** `tests/integration/providerFailover.test.ts`

Test scenarios:
- ✅ Real member execution with mocked provider responses
- ✅ Groq rate limit → Ollama fallback → task completes
- ✅ Claude auth failure → Gemini fallback → task completes
- ✅ All providers fail → error includes all failure reasons
- ✅ Provider recovers mid-execution → circuit closes
- ✅ Config validation: invalid provider name rejected
- ✅ Thread continuity across provider switches

**Mock strategy:** Use `nock` to simulate HTTP responses from LLM APIs

### E2E Tests
**Location:** `tests/e2e/resilience.test.ts`

Test scenarios:
- ✅ `agenthood run the-scribe` with Groq rate limit → completes via fallback
- ✅ `agenthood run the-architect` with network timeout → retries and completes
- ✅ Multi-member execution (The Architect → The Scribe) with provider failure mid-chain
- ✅ Provider recovery: Groq fails, recovers after cooldown, reused in next execution

**Environment:** Use Docker Compose to spin up Ollama for local fallback testing

---

## Acceptance Criteria

### Phase 1: Basic Failover
- [ ] `ProviderFailover` class exists in `src/llm/providerFailover.ts`
- [ ] Loads provider chain from `.agenthood/config.json`
- [ ] Attempts each provider in sequence until one succeeds
- [ ] Collects all failure reasons and throws `AllProvidersFailedError` if all fail
- [ ] Integrated into `executeMember()` in `src/runtime/executor.ts`
- [ ] Existing member executions work without changes (transparent integration)
- [ ] Unit tests pass for basic failover logic
- [ ] Integration test demonstrates Groq → Ollama fallback

### Phase 2: Circuit Breaker
- [ ] Circuit state tracked per provider (in-memory Map)
- [ ] Circuit opens after 3 failures within 60 seconds
- [ ] Open circuit skips provider during failover
- [ ] Circuit transitions to HALF_OPEN after 120 seconds
- [ ] Probe request tests provider recovery in HALF_OPEN state
- [ ] Probe success → CLOSED, probe failure → OPEN with extended cooldown
- [ ] Circuit state logged on every transition (debug level)
- [ ] Unit tests cover all state transitions
- [ ] Integration test demonstrates circuit behavior across multiple executions

### Phase 3: Advanced Recovery
- [ ] HTTP status codes classified (401, 402, 429, 408, 503, 404, network)
- [ ] Permanent failures (401, 402, 404) skip provider without cooldown
- [ ] Rate limit failures (429) parse `Retry-After` header and set cooldown
- [ ] Transient failures (network, 408) use exponential backoff (3 retries)
- [ ] Probe request sent 30 seconds before cooldown expires
- [ ] Probe success restores provider early
- [ ] All failures logged with classification and cooldown duration
- [ ] Unit tests cover all failure classifications
- [ ] E2E test demonstrates rate limit → cooldown → probe recovery

---

## Open Questions

### Q1: Should circuit state persist across runtime restarts?
**Context:** Currently, circuit state is in-memory. If the runtime crashes or is restarted, all providers reset to CLOSED.

**Options:**
- **A:** In-memory only (current)
- **B:** Persist to `.agenthood/cache/circuit-state.json`
- **C:** Use SQLite for circuit state storage

**Deferred because:** This is an optimization for long-running production deployments. The MVP can ship without persistence—failures will be re-learned after restart.

**Decision by:** End of Phase 2 implementation

---

### Q2: Should we emit provider failover events for observability?
**Context:** When a provider fails and failover occurs, the user has no visibility unless they enable debug logging.

**Options:**
- **A:** Emit events to EventEmitter for runtime subscribers
- **B:** Write structured logs to `.agenthood/logs/failover.json`
- **C:** Do nothing—debug logs are sufficient

**Deferred because:** This depends on the broader observability strategy (metrics, telemetry, UI). Can be added later without changing failover logic.

**Decision by:** When observability/telemetry system is designed

---

### Q3: How should member-specific provider preferences interact with failover?
**Context:** The Doorman wants fast/cheap providers (Groq, Ollama). The Architect wants deep reasoning (Claude, Gemini). Should the failover chain be member-aware?

**Options:**
- **A:** Global failover chain (all members use same chain)
- **B:** Per-member provider preferences override global chain
- **C:** Per-member primary provider, global chain for fallback

**Deferred because:** This is explicitly out of scope for this spec. Member preferences are a separate feature that can layer on top of failover later.

**Decision by:** When member preferences spec is written (issue TBD)

---

## Implementation Notes

### Directory Structure
```
src/llm/
├── providerFailover.ts          # ProviderFailover class
├── providerFailover.test.ts     # Unit tests
├── circuitBreaker.ts            # CircuitBreaker class (Phase 2)
├── circuitBreaker.test.ts       # Circuit breaker unit tests
├── failureClassifier.ts         # Failure classification logic (Phase 3)
└── failureClassifier.test.ts    # Failure classifier tests
```

### Configuration Schema
Add to `.agenthood/config.json`:

```json
{
  "llm": {
    "providers": [
      {"name": "anthropic", "model": "claude-sonnet-4.6"},
      {"name": "google", "model": "gemini-2.5-pro"},
      {"name": "openai", "model": "gpt-4o"},
      {"name": "groq", "model": "llama-3.1-70b-versatile"}
    ],
    "failover": {
      "enabled": true,
      "circuitBreaker": {
        "failureThreshold": 3,
        "failureWindow": 60,
        "cooldownDuration": 120,
        "probeBeforeCooldown": 30
      }
    }
  }
}
```

### Error Handling
```typescript
class AllProvidersFailedError extends Error {
  constructor(
    public failures: Array<{ provider: string; error: Error; classification: string }>
  ) {
    super(`All providers failed:\n${failures.map(f => 
      `- ${f.provider}: ${f.error.message} (${f.classification})`
    ).join('\n')}`);
  }
}
```

### Thread Continuity
**Assumption:** Threads are stateless—each `executeMember()` call is independent. No checkpoint/restore needed for MVP.

**If thread continuity is required later:**
- Persist conversation history to `.agenthood/cache/threads/{threadId}.json`
- Reload history on provider switch
- This is a separate feature—not blocking this spec

---

## Success Metrics

How we know this is working in production:

- **Failover success rate:** % of executions that succeed after failover (target: >95%)
- **Mean time to recovery:** Average time from failure to successful provider switch (target: <5s)
- **Provider health score:** % uptime per provider over 24h window
- **Circuit breaker effectiveness:** % of avoided requests to known-bad providers
- **Probe recovery rate:** % of providers restored via probe vs. timeout

These metrics can be logged to `.agenthood/logs/failover-metrics.json` or emitted via telemetry (out of scope for this spec, but design should allow future instrumentation).

---

## References

- **Architecture Doc:** [architecture/provider-failover.md](../../architecture/provider-failover.md)
- **Issue:** #161 — Implement ProviderFailover for resilience
- **Pattern:** [Circuit Breaker Pattern (Martin Fowler)](https://martinfowler.com/bliki/CircuitBreaker.html)
- **Related ADRs:** 
  - ADR-009: Groq as Default LLM Provider
  - ADR-008: TypeScript Runtime over Python
