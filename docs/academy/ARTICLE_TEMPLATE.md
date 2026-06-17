# [Concept Name]

<!-- Society-voice hook: one sentence. Declarative. Stakes-first.
     Example: "Poor chunking quietly destroys retrieval quality. The Society does not tolerate quiet destruction."
     Example: "Agents that cannot plan cannot be trusted. Planning is not optional." -->

> [One-line hook here.]

---

## What it is

<!-- Plain-language explanation. No jargon without definition.
     Target: a TypeScript developer who knows nothing about this concept.
     Length: 2–4 paragraphs. No bullet lists in this section. -->

[Explanation here.]

---

## Why it matters in production

<!-- The failure mode this concept prevents. Real consequences.
     Not hypothetical — what actually breaks when you skip this.
     Length: 1–3 paragraphs or a short list of specific failure scenarios. -->

[Failure modes and consequences here.]

---

## How Agenthood implements it

<!-- Link to the actual class or interface in the source.
     Include a concise code snippet (10–20 lines max) showing the API.
     If the component is planned for a future milestone, say so clearly with the milestone number. -->

Agenthood implements this in [`src/path/to/File.ts`](../../src/path/to/File.ts):

```typescript
// Code snippet showing the key API
```

[Brief explanation of the implementation.]

---

## Hands-on example

<!-- Something the reader can run immediately.
     Prefer `agenthood run` commands. Fall back to copy-paste TypeScript.
     If this requires a future milestone, provide a minimal standalone example instead. -->

```bash
# What to run
agenthood run --example
```

Or in TypeScript:

```typescript
// Minimal runnable example
```

[Expected output or result.]

---

## Further reading

<!-- Three links:
     1. The relevant ADR (docs/adr/)
     2. The source file this article covers
     3. One high-quality external reference (paper, RFC, well-known blog post) -->

- [ADR-XXX — Decision title](../../docs/adr/ADR-XXX-description.md)
- [`src/path/to/File.ts`](../../src/path/to/File.ts) — source implementation
- [External reference title](https://example.com) — brief note on why this source

---

## LinkedIn version

<!-- One repurposing template per article.
     Format: hook (= first sentence of "What it is") + 3 bullets (= "Why it matters" points) + CTA.
     Keep the hook punchy. The CTA links to this article on GitHub Pages. -->

**Hook:** [First sentence of "What it is" section, rewritten as a LinkedIn opener.]

**Why it matters:**
- [Point 1 from "Why it matters in production"]
- [Point 2]
- [Point 3]

**→** [Read the full article + implementation walkthrough →](https://agenthood.flabs.tech/academy/[path-to-this-article]/)
