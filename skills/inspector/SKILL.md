---
name: inspector
description: Solve and generate challenging multimodal visual-reasoning questions involving pixel ranking, cross-panel coordinate mapping, graph-cut side classification, and confidence-bearing answer extraction. Use when the task asks for precise interpretation of low-resolution images, multi-panel figures, or benchmark-style vision questions.
allowed-tools: file.read file.search code.explain ask_human file.write code.write code.refactor
license: MIT
metadata:
  version: 1.0.0
---

# The Inspector

## Overview

Visual benchmarks punish confident guessing. The Inspector reads low-resolution
images the way a forensic analyst reads a scene: rank the candidates, map
coordinates across panels, decide which side of a cut each pixel belongs to, then
state how sure the answer is. Failure modes get written down so the next run can
reproduce the reasoning instead of re-deriving it.

## When to Use

Use this skill when the user asks for:
- the darkest/lightest pixels in a region
- which side of a boundary or cut an item falls on
- counting items after mapping them across panels
- short-answer vision benchmarks with exact ground truth
- multi-panel visual reasoning with subtle differences

## Inputs

- One or more image panels
- A precise question with:
  - target region or panel
  - ranking rule or selection rule
  - boundary/cut definition
  - final counting or classification goal

## Process

1. Restate the task in coordinate terms.
2. Identify the relevant panel(s) and coordinate system.
3. Find candidate items using the exact criterion.
4. Map each item across panels using consistent spatial alignment.
5. Classify each item against the boundary or cut.
6. Count only the items that satisfy the target condition.
7. Return answer, confidence, and a short reasoning trace.

## Reasoning rules

- Prefer exact visual evidence over inference.
- Do not invent missing pixels, labels, or panels.
- If the boundary is thick, ambiguous, or subjective, say so.
- If panel alignment is unclear, reduce confidence.
- When the question depends on a final count, verify the count twice.

## Output format

- Answer: <short final answer>
- Confidence: <percentage>
- Trace: <3-6 bullets>
- Failure modes: <optional bullets>

## Common failure modes

- Misranking visually similar intensities
- Off-by-one errors in row/column indexing
- Wrong panel correspondence
- Treating a thick cut as a precise line
- Double-counting boundary items
- Overconfident answers when the image is ambiguous

## Generation mode

When asked to create benchmark questions:
- Use small grids, repeated patterns, and subtle intensity differences
- Include 2-4 panels with a transformation between them
- Add one boundary, cut, or region-classification step
- Make the final answer a small integer or short label
- Ensure there is a single ground truth under a clearly stated convention

## Red Flags

- Overconfidence when pixel intensities are nearly identical
- Assuming perfect panel alignment without verification
- Treating a thick boundary as a precise line
- Double-counting items that fall exactly on the cut

## Rationalizations

| What you think | What The Inspector knows |
|---------------|--------------------------|
| "The pixels are clearly different" | Visual similarity can deceive: measure, don't judge |
| "The panels are aligned" | Verify alignment explicitly: one pixel offset changes the answer |
| "The cut is obvious" | Thick cuts have ambiguous center lines: state your convention |

## Verification

- Is the target item count unambiguous?
- Are panels spatially aligned?
- Is the cut rule defined?
- Can the answer be checked by a deterministic count?
- Is confidence calibrated to ambiguity?
