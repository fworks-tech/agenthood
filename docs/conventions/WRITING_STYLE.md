# Writing Style

The Agenthood is read by engineers who are deciding whether to trust it. The
prose should sound like a senior colleague explaining a decision, not like a
product page. Short sentences, concrete nouns, and a reason for every claim.

## Punctuation

Use the punctuation that does the job, not a dash standing in for all of them.

| Instead of a dash | Use | Example |
|-------------------|-----|---------|
| An explanation | colon | "The cache is safe: it is keyed by file mtime." |
| An aside or appositive | comma | "The reviewer, not the author, decides." |
| A new independent sentence | period | "The run failed. The trace shows why." |
| A list-like aside | parentheses | "Every member (Scribe, Architect, Reviewer) loads the same way." |
| A numeric range | hyphen | "2023-2026", "60-300s" |

Do not use an em dash (U+2014) or an en dash (U+2013) in prose. The one exception is an
external identifier that must match GitHub exactly, such as a required check
name. Those live in `.github/workflows/`, `.github/scripts/herald-summary.cjs`
and its test fixture, and they are allowlisted.

## Voice

- Lead with the claim or the action. Leave the wind-up out.
- Prefer a concrete number to an adjective: "under 50ms" beats "blazing fast".
- Name the failure the rule prevents. A rule with a reason survives review.
- Write "you" for the reader and "we" for the project. Avoid "one" and passive
  constructions that hide who acts.
- Keep a sentence under about 25 words. If it needs two clauses and a list, split it.

## Stock phrases to avoid

These are the phrases that make text read as generated. Replace them with the
specific thing you mean.

| Avoid | Write instead |
|-------|---------------|
| `delve into` | read, examine, open |
| `leverage` | use |
| `robust` / `comprehensive` / `holistic` | name the property or the coverage |
| `seamless` / `seamlessly` | "without a restart", "in one step" |
| `unlock` / `elevate` / `empower` | the concrete outcome |
| `cutting-edge` / `state-of-the-art` | the version or the capability |
| `it is worth noting` | say the thing, or cut it |
| `let's dive` / `deep dive` | start with the finding |
| `at the end of the day` / `when it comes to` | cut both |
| `tapestry` / `realm` / `testament to` | the literal subject |

The list is a warning, not a ban. "Robust against malformed input" is a
technical claim; "a robust solution" is filler. The checker reports the phrase
and leaves the judgement to the author.

## Lists and headings

- A heading is a noun phrase, not a sentence: "Skill discovery", not "How skills are discovered".
- A bullet starts with a capital and ends without a period unless it is a full sentence.
- Keep bullets parallel: all imperative, or all noun phrases, not a mix.
- Do not put two independent sentences in one bullet.

## Code and generated files

- Code comments follow the same rules as prose. No em dash, no stock phrasing.
- Generated files (`docs/release-notes.md`, `CHANGELOG.md`, `docs/api/`) are not
  edited by hand. Fix the generator instead.
- A string that mirrors an external identifier keeps that identifier exactly.

## Check

```bash
npm run lint:prose
```

The check fails on an em or en dash in a tracked text file and prints the stock
phrases it found. It runs in CI on every pull request.
