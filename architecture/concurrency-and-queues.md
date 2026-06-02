# Concurrency and Queue Management

> *The Society is busy. It has a system for that.*

---

## Overview

The Agenthood handles multiple requests without stepping on itself.
A `ConcurrencyQueue` ensures that work is prioritized, slots are respected,
and no request starves while low-priority background tasks run indefinitely.

---

## Concurrency Slots

The queue operates with configurable concurrency:

| Setting | Default | Range |
|---------|---------|-------|
| Concurrent slots | 3 | 1–10 |
| Max queue depth | 30 (10× slots) | — |

When all slots are occupied, new requests enter the queue.
When a slot opens, the highest-priority queued request takes it.

---

## Priority Levels

Every request enters the queue with a priority level:

| Level | Value | Who uses it |
|-------|-------|-------------|
| `USER` | 2 (highest) | Direct user requests — always first |
| `SCHEDULED` | 1 | Ritual automations (standup, health check) |
| `BACKGROUND` | 0 (lowest) | Indexing, cache warming, passive monitoring |

**Rule:** A user request always jumps ahead of scheduled and background work.
A scheduled ritual always jumps ahead of background work.

---

## Starvation Prevention

A low-priority task should never wait forever because high-priority work
keeps arriving. The queue implements automatic priority escalation:

- If a task has been waiting **60 seconds**, its priority is boosted by 1 level
- A `BACKGROUND` task becomes `SCHEDULED` after 60s of waiting
- A `SCHEDULED` task becomes `USER` after 60s of waiting
- Once escalated, it cannot be demoted back

This guarantees eventual execution for every queued task.

---

## Queue Depth Cap

When the queue is full (depth = 10× concurrency limit):

- New `BACKGROUND` requests are **rejected** — background work can be retried
- New `SCHEDULED` requests are **held** — they wait for a slot to open in the queue
- New `USER` requests are **always accepted** — they displace the lowest-priority queued item if necessary

The user is never blocked by background work.

---

## Status Visibility

The current queue state is surfaced in the agent runtime's status display:

```
⚡ 2 running  •  3 queued  •  1 paused (approval needed)
```

This lets the developer see what the Society is doing at a glance.

---

## Task Lifecycle

```
Request arrives
    ↓
InputValidator          — sanitize, classify, assign priority
    ↓
Queue.enqueue(priority) — wait for available slot
    ↓
Slot available?
  ├── Yes → Execute immediately
  └── No  → Wait in queue (starvation timer starts)
    ↓
Execution begins
    ↓
Completion / Error / Approval Gate
    ↓
Slot released → next queued task promoted
```

---

## Implications for Members

- **The Doorman** runs at `USER` priority — validation never waits
- **The Herald's** standup automation runs at `SCHEDULED` priority
- **The Librarian's** background doc sync runs at `BACKGROUND` priority
- Any member task triggered by the user runs at `USER` priority regardless of member type
