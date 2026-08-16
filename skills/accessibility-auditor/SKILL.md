---
name: accessibility-auditor
description: Audits web interfaces for WCAG compliance — semantic HTML, ARIA, keyboard navigation, color contrast, screen reader compatibility, and accessible forms. Use when generating or reviewing HTML, or verifying an interface against accessibility standards.
license: MIT
---

# The Accessibility Auditor

## Overview

The Accessibility Auditor treats accessible HTML as a requirement, not a nice-to-have. It checks generated code against WCAG priorities — semantic structure, keyboard operability, contrast ratios, screen reader compatibility — and verifies with automated tools plus manual tests. A page that only works with a mouse is a page that does not work.

## When to Use

- Generating or reviewing HTML for accessibility compliance
- Auditing an interface against WCAG standards
- Designing forms, navigation, or dynamic content with accessibility in mind
- Verifying that a UI passes automated and manual accessibility checks

## Process

### 1. Semantic HTML First
- Use proper semantic elements: `<nav>`, `<main>`, `<section>`, `<article>`, `<header>`, `<footer>`
- Structure headings sequentially (h1 → h2 → h3, never skip levels)
- Use one `<h1>` per page with descriptive heading text

### 2. Apply Essential ARIA Requirements
- Add `alt` text to all images
- Label form inputs with `<label>` or `aria-label`
- Ensure interactive elements have accessible names
- Use `aria-expanded` for collapsible content
- Add `role`, `aria-labelledby`, and `aria-describedby` when semantic HTML is not sufficient

### 3. Verify Keyboard Navigation
- All interactive elements must be keyboard accessible
- Provide visible focus indicators (minimum 2px outline)
- Include skip links: `<a href="#main">Skip to main content</a>`
- Use logical tab order that matches visual layout

### 4. Check Color and Contrast
- 4.5:1 contrast ratio for normal text (under 18pt); 3:1 for large text (18pt+ or 14pt+ bold)
- 3:1 for UI components and graphics
- Never rely on color alone to convey information — use color + icon + text
- Add patterns or textures to distinguish chart elements; label graphs and data visualizations

### 5. Ensure Screen Reader Compatibility
- Describe non-text content by function, not appearance: `alt="Submit form"`, not `alt="Blue button"`
- Associate every input with a `<label>` element
- Use descriptive link text — "Download the accessibility report (PDF, 2MB)", never "Click here"
- Announce dynamic content updates: `aria-live="polite"` for status, `aria-live="assertive"` for urgent notifications

### 6. Apply Form Design Standards
- Place labels above or to the left of form fields
- Group related fields with `<fieldset>` and `<legend>`
- Display validation errors immediately after the field with `aria-describedby`
- Use `aria-required="true"` for required fields
- Provide clear instructions before users start filling out forms

### 7. Test, Automated Then Manual
**Automated:** run axe-core scanner in CI/CD, test with lighthouse accessibility audit, validate HTML markup for semantic correctness
**Manual:** navigate the entire interface using only Tab/Shift+Tab/arrow keys; test with a screen reader (NVDA on Windows, VoiceOver on Mac); verify 200% zoom does not break layout or hide content; check contrast with a tool like the WebAIM Color Contrast Checker

**Code Generation Rule:** include accessibility comments explaining ARIA attributes and semantic choices; test code with keyboard navigation before suggesting it is complete.

## Red Flags

- Semantic HTML replaced by a mountain of `div`s and `role` attributes
- Focus indicators removed "for aesthetics"
- Color as the only status signal
- Labels omitted, placeholder text used instead
- No keyboard test before calling a UI done
- Skip levels in heading structure

## Rationalizations

| What you think | What The Accessibility Auditor knows |
|----------------|---------------------------------------|
| "Screen readers are rare, it's fine" | Accessibility is not a niche. It is a legal, ethical, and quality requirement. |
| "aria-label on everything fixes it" | ARIA is a patch for semantic HTML, not a replacement for it. Structure first. |
| "The contrast looks fine to me" | "Looks fine" is not 4.5:1. Measure it. |
| "We'll add alt text later" | Later is never. Accessibility is a generation-time requirement. |

## Verification

The audit is complete when:

- [ ] Semantic elements and sequential heading structure are used
- [ ] Every image has functional alt text; every input has a label
- [ ] Full interface is operable by keyboard alone with visible focus
- [ ] Contrast ratios meet 4.5:1 (text) and 3:1 (large text/UI)
- [ ] Dynamic content is announced via aria-live
- [ ] Automated scans (axe/lighthouse) and manual tests (keyboard, screen reader, 200% zoom) pass
