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

Do not use an em dash (U+2014) or an en dash (U+2013) in prose. The one
exception is an external identifier that must match GitHub exactly, such as a
required check name. Inside `.github/workflows/` only the workflow and job
`name:` lines and the watched-workflow list in `herald.yml` keep their dash;
every other line there follows the rule, including step names.
`.github/scripts/herald-summary.cjs` and its test fixture mirror those names and
are exempt as whole files.

A line that must contain the character itself, such as a test fixture, ends with
`prose-lint-ignore`.

## Voice

- Lead with the claim or the action. Leave the wind-up out.
- Prefer a concrete number to an adjective: "under 50ms" beats "blazing fast".
- Name the failure the rule prevents. A rule with a reason survives review.
- Write "you" for the reader and "we" for the project. Avoid "one" and passive
  constructions that hide who acts.
- Keep a sentence under about 25 words. If it needs two clauses and a list, split it.

### Do not trade a dash for a metronome

A colon explains or introduces. It is not the default substitute for every dash,
and a page of "Claim: explanation. Claim: explanation." reads as machine output
even when every sentence is correct.

Take the punctuation the sentence needs, and vary it across a paragraph:
a comma for an aside, a period for a new thought, parentheses for a digression.

| Mechanical | Natural |
|------------|---------|
| "The Warden does not rewrite. It identifies, reports, and blocks." | "The Warden reports what it finds and blocks the merge. Fixing stays with the developer." |
| "It is not paranoid; it is precise." | "It verifies rather than assumes." |
| "Every release has a version. Every release has notes. Every release was earned." | "Each release carries a version and notes, and ships only after tests and a merged PR." |

### Avoid the shared template

Each member file describes a different job. When twenty of them open with
"The X does not ..., it ...", the reader stops hearing the role and starts
hearing the pattern.

- Vary the opening: start with the problem, the artifact, or a concrete example.
- Do not close on an aphorism. End on the consequence or the check that follows.
- One triad per page is enough. Three parallel sentences in a row is a tell.
- In a tutorial, say what the reader will build and what runs at the end.
  Skip the announcement that the article is about to begin.
- Italics do not make a verb stronger: "It *announces* it" is louder than
  "It announces the release".

The test is whether the paragraph would survive being read aloud by the person
who does the job. If it sounds like a tagline, rewrite it.

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
| `myriad` / `plethora` / `synergy` | the count or the effect |
| `foster` / `embark` / `streamline` | start, run, shorten |
| `crucial` / `underscore` | important, shows |
| `game-changer` / `paradigm shift` / `best-in-class` / `ever-evolving` | the change itself |
| `in today's` | now, or cut it |

Keep this table in sync with `STOCK` in `scripts/check-prose.mjs`, which is what
the check reads.

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
  edited by hand. Fix the generator instead. Historical entries in the two
  changelogs were normalized once when this rule landed; new entries come from
  the generator.
- A string that mirrors an external identifier keeps that identifier exactly.

## Check

```bash
npm run lint:prose
```

The check fails on an em or en dash, or an escaped dash code point, in any
tracked text file, including extensionless scripts, code strings and metadata.
It prints the stock phrases it found and runs in CI on every pull request.
