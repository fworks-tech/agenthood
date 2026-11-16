# Creating a Member

A member is a `SKILL.md` file with a name, a description, and instructions a model can follow. This
guide takes you from nothing to a reviewed member in six steps. The reference contract — trust model,
versioning, registry names — lives in [Third-Party Members](../members/contrib-members.md); this page
is the walkthrough.

Everything below is copy-paste ready. The worked example builds *The Translator*, a member that turns
technical specifications into plain language.

---

## 1. Before you start

Read [The Oath](../../oath.md). It is one page and it sets the standard: a member does not flatter, it
does not guess, and it does not claim work it did not do.

Skim [The Oracle](../../skills/oracle/SKILL.md). It is the member that writes members, and it holds the
naming rules and the section template this guide follows.

You need nothing else — no account, no build step. A `SKILL.md` file is the whole deliverable.

## 2. Name your member

- One word, noun form, formal register: `Scribe`, `Warden`, `Translator`
- It must read naturally as "The *Name*" and double as a job title
- Lowercase, hyphen-separated in the file and directory: `the-translator`
- Reject modern corporate words (`Coordinator`, `Facilitator`) and generic ones (`Helper`)
- Check it is not taken: `ls skills/`, then `npx agenthood skills` to see what a project has installed

The name is the identity. If it changes later, every link and every reference breaks.

## 3. Create the file

```
skills/contrib/the-<name>/
└── SKILL.md
```

`skills/contrib/` is the third-party home. Discovery walks it automatically, so there is no registry
file to edit. If you are adding a member *to this repository* rather than to your own project, use
`skills/the-<name>/` and follow the registration list in [The Oracle](../../skills/oracle/SKILL.md).

The frontmatter is small and strict:

```yaml
---
name: the-translator
description: Rewrites technical specifications as plain language for a non-technical reader. Use when a spec, RFC, or design doc has to be understood by product, support, or a customer.
license: MIT
metadata:
  author: your-handle
  version: 0.1.0
source_url: https://github.com/you/the-translator
---
```

`description` is what the model sees when choosing a member. Front-load the trigger words, name both
*what it does* and *when to use it*, and keep it under about two sentences — it is paid for on every
request.

## 4. Write the six sections

Every member has the same shape. The Sentinel checks for it, and readers rely on it.

| Section | Answers |
|---------|---------|
| `## Overview` | What this member is and the failure it prevents |
| `## When to Use` | The concrete situations, and what it is *not* for |
| `## Process` | The ordered steps, imperative and verifiable |
| `## Red Flags` | What the member must stop and report |
| `## Rationalizations` | The excuses it must refuse, with the counter |
| `## Verification` | How to check the work before calling it done |

A complete member, ready to copy:

```markdown
---
name: the-translator
description: Rewrites technical specifications as plain language for a non-technical reader. Use when a spec, RFC, or design doc has to be understood by product, support, or a customer.
license: MIT
metadata:
  author: your-handle
  version: 0.1.0
source_url: https://github.com/you/the-translator
---

# The Translator

## Overview

A specification written for engineers is not a specification a product manager can approve. The
Translator rewrites one for a named reader without losing a requirement, a constraint, or a
non-goal. It translates; it does not summarise away the parts that make the decision hard.

## When to Use

- A spec, RFC, or design doc must be understood outside engineering
- A customer or support team needs the behaviour, not the implementation
- A decision-maker has to approve something they cannot currently read

Use only with a real document as input. If there is no source text, write the document first.

## Process

### 1. Name the reader

Write the reader and their existing knowledge in one line: "Support engineer, knows the product,
not the internals." Every later choice is judged against that line.

### 2. Extract the claims

List every requirement, constraint, and non-goal from the source, in order, with the section it came
from. This list is the completeness check.

### 3. Rewrite for the reader

For each claim: state it, then explain why it matters to that reader. Replace internal names with
the behaviour they describe. Keep numbers exact — a timeout of 30 seconds stays 30 seconds.

### 4. Mark what did not survive

Where a claim cannot be translated without losing meaning, quote it and say why. Never drop one
silently, and never invent a simplification the source does not support.

### 5. Read it back

Check the rewrite against the claim list. Every claim present, no claim added, every number
unchanged.

## Red Flags

- A source claim with no counterpart in the rewrite
- A technical term replaced with a vaguer one that changes the guarantee
- A summary that hides a non-goal, making the scope look larger than it is
- Numbers rounded, units dropped, or timeouts paraphrased
- Examples invented to explain a rule the source did not give

## Rationalizations

| What you think | What a translator knows |
|---|---|
| "The reader will not need this constraint" | The constraint is usually the decision; dropping it changes the answer |
| "A simpler example is clearer" | An invented example teaches the reader something the document does not say |
| "Rounded numbers read better" | A rounded limit is a wrong limit |
| "This section is already plain" | Then it costs one line to confirm, and nothing to skip it |

## Verification

- The reader named in step 1 appears in the output
- Every claim on the extracted list appears in the rewrite
- No claim, number, or non-goal was added
- Untranslatable claims are quoted with the reason
- A non-engineer reads it and can state what will happen and what will not
```

That is the whole file. `npx agenthood create the-translator` scaffolds the same shape if you prefer
not to copy.

## 5. Register it

Three things make a member real, and none of them is a config edit:

1. **Location** — `skills/contrib/the-<name>/SKILL.md` inside the project (or this repo). Discovery
   finds it on the next run.
2. **Frontmatter** — `metadata.author` is your handle and becomes the `owner` in `owner/name`; the
   `name` matches the directory.
3. **Lockfile** — `npx agenthood verify --update-lock` records the file hash so drift is detectable.

Check the whole thing:

```bash
npx agenthood verify --contrib   # owner and source_url present, structure valid
npx agenthood skills             # listed, not blocked
npx agenthood verify --update-lock
```

## 6. Submit it

Open a PR (or a PR to the registry, when publishing). The PR is reviewed on four axes:

- **Structure** — the six sections, the frontmatter, the name
- **Behaviour** — does the Process actually produce the outcome it claims?
- **Security** — anything that executes code gets a security review before it is listed
- **Permissions** — the member's profile stays read-only unless it has a reason not to

Say in the PR why the member exists, what it is *not* for, and how you tested it. A member with no
tested Process is a prompt, not a member.
