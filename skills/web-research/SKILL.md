---
name: web-research
description: Runs a systematic web research task; plan the subtopics, delegate each to a parallel search, save findings with citations, then synthesise one cited report. Use when a question needs current external sources rather than the repository's own knowledge.
license: MIT
allowed-tools:
  - file.read
  - file.write
  - file.search
---

# Web Research

## Overview

A research answer is only as good as the trail behind it. This skill turns a vague request into a plan, splits the plan into independently searchable subtopics, runs those searches in parallel, and writes one report where every claim points at a source. The output is a file, not a chat message, so the evidence survives the session and the next reader can check it.

The two failure modes it exists to prevent: a single search that returns plausible prose nobody can verify, and a long conversation where sources are quoted once and lost.

## When to Use

- The question depends on something outside the repository: a library's current behaviour, a vendor's terms, a benchmark, a recent release
- The answer needs several independent angles (cost, security, adoption, maintenance) that one query cannot cover
- Someone will act on the answer, so the sources have to be checkable afterwards
- You are asked to "research", "compare", "find out what the industry does", or "check whether X is still true"

Use only when the web is the source. A question about this codebase is not a research task: read the code.

## Process

### 1. Write the plan before searching

State the question in one sentence, then list 3-5 subtopics. Each subtopic is a claim you expect to confirm or refute, not a keyword. Write the plan down (in the report file's opening section) so a wrong plan is visible before it costs searches.

Reject a subtopic you cannot name the expected source type for (a spec, a changelog, a paper, a pricing page).

### 2. Delegate the subtopics in parallel

One agent per subtopic, each with its own budget of 3-5 searches. Give each agent the subtopic, the expected source type, and the instruction to return:

- the claim, in one sentence
- the source URL and its publication or last-updated date
- the supporting quote or number, verbatim
- a confidence note: primary source, secondary reporting, or unverified claim

Do not let one agent cover several subtopics; depth beats breadth per agent, and the parallel branches keep the searches independent.

### 3. Save findings as files, not messages

Write each subtopic's findings to `research/<subtopic>.md` before synthesising. Files let a later step re-read the evidence instead of trusting a summary, and they make gaps obvious: an empty or thin file is a gap, a confident paragraph is not.

A finding with no URL, or with a URL you did not open, is not a finding. Record it as "unverified" rather than dropping it silently.

### 4. Synthesise into one cited report

Write `research/report.md` with:

1. **Answer**: the direct answer first, in two or three sentences
2. **Findings**: one section per subtopic, each claim carrying `[n]`
3. **Disagreements**, where sources conflict, state both positions and which one the evidence favours
4. **Gaps**: what the research did not establish, and what would establish it
5. **Sources**: numbered, with URL and date accessed

Prefer the primary source over the article that summarises it. When only secondary sources exist, say so in the claim.

### 5. Verify the trail

Re-read the report against the finding files. Every claim in the answer section must trace to a numbered source. Delete any sentence you cannot trace, or move it to Gaps.

## Red Flags

- A report whose sources were never opened, only quoted from a search snippet
- A single search standing in for a multi-angle question
- Findings kept only in the conversation, so the next step cannot re-read them
- A confident claim with no date on a fast-moving topic
- Subtopics invented after the searches, to match what was found
- Synthesis that resolves a disagreement without saying it existed

## Rationalizations

| What you think | What a researcher knows |
|---|---|
| "The snippets already answer it" | A snippet is a sentence lifted out of context; the context is where the caveat lives |
| "One thorough search is faster" | It answers the question you asked, not the one you should have asked |
| "I'll cite at the end" | Sources collected afterwards get matched to claims by memory, which is how unverifiable claims appear |
| "The sources disagree, so it's inconclusive" | A disagreement is a finding; say which side the evidence supports |

## Verification

- The report answers the original question in its first paragraph
- Every claim in the answer section carries a numbered source
- Each source was opened, dated, and is reachable at the recorded URL
- Findings exist as files under `research/`, not only in the transcript
- Conflicts and gaps are named rather than smoothed over
