# Skill Best Practices, for This Architecture

> The general advice ("be clear, be specific") is true everywhere and useful nowhere. This page is
> what changes when the skill is one of twenty agents in a chain, paying rent in context on every
> request.

---

## 1. Write down expertise, not a job description

A skill that says "review code for quality" teaches a model nothing it does not already do. A skill
earns its tokens by encoding what a senior person knows and a generic model does not:

- the order to check things in, and why that order
- the failure that has actually happened before
- the shortcut that looks right and is wrong
- the threshold ("above ~200 lines, split it") a junior would not know

Test: delete every line a competent model would produce unprompted. What is left is the skill. If
nothing is left, the skill is a prompt wrapper: fold it into the description and delete the file.

**Do not** pad a body to fill the six sections. An empty `## Verification` is a signal that the work
was never defined, not a formatting gap.

## 2. Spend context like it is money

Every request pays for the catalog: name, description, location. Every activation pays for the body.
Both are on the bill, and they are paid repeatedly.

| What | When it is paid | Budget | Lever |
|------|-----------------|--------|-------|
| Catalog entry | every request, every skill | ~4000 tokens total (`skills.metadataBudget`) | description length, `disable-model-invocation`, removal |
| Body | every activation | ~5000 tokens (`token-budget`) | move detail into `references/` |
| Reference | when the body says to read it | unbounded | it is a file read, not prompt text |
| Script output | when the script runs | 30 KB inline, rest spilled | return structured, small output |

`agenthood status` shows the catalog cost per skill; `agenthood verify --tokens` shows the body cost;
`agenthood optimize --cost` ranks both against how often the skill actually triggers. A skill nobody
activates is pure cost: either fix its description or hide it.

**Progressive disclosure is the pattern:** the body tells the model *when* to read
`references/whatever.md`, and the file is read only by the runs that need it. A 60-line body with
three references beats a 400-line body that carries the same detail for every task.

## 3. Design for a chain, not a conversation

In a multi-agent run, a skill's output is another skill's input. Three rules follow:

1. **Write an output contract.** "Return a table with file, issue, severity" travels; a friendly
   summary does not. If a later member parses it, say so in the body.
2. **Hand off, do not take over.** When work belongs to a sibling, name the sibling and the reason and
   stop. `the-reviewer` flagging a missing regression test and handing it to
   [`the-tester`](../../skills/tester/SKILL.md) is a handoff; writing the test itself is scope creep
   that duplicates another member's rules.
3. **One owner per rule.** Two files stating "never merge with red CI" drift the first time one is
   edited. The owner states it; everyone else links to it.

`chains.yaml` gives you the sequencing primitives: `member`, `skill`, `parallel`, and
`when: { step, contains }` for a step that only runs on a blocking finding. A skill that expects a
review gate should say so in its body, so the gate is not a surprise.

## 4. Say what you refuse

A skill with no red flags is a skill that will rationalise. The useful section is not "be careful",
it is the specific excuse and its counter:

| Excuse | Counter |
|--------|---------|
| "Tests pass, so it's done" | Passing tests that never exercised the branch are a claim, not evidence |
| "The diff is small" | Small diffs are where auth checks disappear |
| "I'll document it later" | Later is a different run with none of this context |

Write the excuse you have actually seen. A red flag nobody hits is decoration.

## 5. Gotchas that cost real debugging time

- **The name is the key.** Directory, frontmatter, chain step and lockfile must agree. A rename without
  `verify --update-lock` shows as drift, and a rename without updating chains silently misses.
- **A body is not a tool.** Instructions cannot fetch. If the step needs the network or the filesystem,
  it is a bundled script (Docker by default) or a tool call: say which.
- **Relative paths resolve from the skill directory**, not the project root. `references/x.md` is
  inside the skill; `../x.md` is outside and refused.
- **`allowed-tools` can only narrow.** It intersects with the member's profile; declaring a tool the
  profile does not grant does not grant it.
- **Activation is additive in scope, intersecting in tools.** Loading a second skill narrows the
  effective tool set to the intersection of both.
- **A description is a routing signal.** "Use when…" works; a noun phrase does not. The trigger-rate
  harness (`agenthood eval --triggers`) measures this against both keyword and semantic surfaces.
- **Bodies survive compaction by default.** One-shot instructions (a migration, a destructive step) set
  `compaction-replay: false`, or a re-activation will point at a body that may have been summarised.

## 6. Templates to start from

| Need | Start here |
|------|-----------|
| A member authored from scratch | [The Oracle](../../skills/oracle/SKILL.md) template |
| A minimal third-party member | [`examples/contrib/the-example`](../../examples/contrib/the-example/SKILL.md) |
| A full walkthrough | [Creating a Member](creating-a-member.md) |
| Scripts with no interface surprises | [Script Design](script-design.md) |
| Knowing whether it works | [Skill Evaluation](skill-evaluation.md) |

## Verification

- Every line is something a generic model would not have produced unprompted
- The body is under 5000 tokens and long material lives in `references/`
- The description says both what it does and when to use it
- Every sibling rule is linked, not restated
- The red flags are real excuses, with counters
- `agenthood verify --strict`, `--tokens` and `--budget` pass
- The trigger-rate harness shows more true activations than false ones
