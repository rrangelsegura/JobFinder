---
name: extracting-lessons
description: Use when the user asks to extract key lessons, takeaways, or teachings from a source (video, PDF, podcast, URL, .md, .json, or similar) into a structured list — distinct from pulling isolated concept definitions or writing a general summary
---

# Extracting Lessons

## Overview

Turn one source into a JSON list of lessons: teachings built by combining two or more facts from the source into a cause/effect, trade-off, or comparison — specific enough that they wouldn't read the same if pasted into an unrelated source on the same general topic. A lesson sits between an atomic concept (too granular, one fact) and a summary (too general, could be about any source on the topic).

## When to Use

- User names one source and wants its key lessons/takeaways, not just term definitions
- Output should be structured (JSON), not prose

Not for: pulling atomic term definitions (that's a flatter, one-fact-per-entry job), or writing a narrative reference doc (that's a different shape of output).

## Workflow

### 1. Get the real content

Never infer lessons from the title alone. Use real transcript/text extraction. If extraction fails, say so.

If the named source is a landing/index page whose actual content lives in linked sub-pages (a chapter overview that summarizes and links out to detail pages), follow those links — the source is the substance, not just the one URL. If your extraction tool itself summarizes before returning text (e.g. a fetch tool that runs a small model over the page), treat what it returns as ground truth for quotes, but be aware of possible paraphrase drift — re-verify against raw text when exact wording matters for a quote you're citing.

### 2. Apply the focus, if given

If the user names a focus/angle, prioritize lessons relevant to it. No focus given → cover the source's main sub-topics.

### 3. Apply the synthesis test to every candidate lesson

A lesson must combine **at least two independently-grounded facts** from the source into one relationship: cause → effect, trade-off, or comparison (including a comparison across the source's own sub-cases — that counts as synthesis, not as "just listing facts").

Two failure modes to actively check for:

- **Disguised concept:** strip the framing/topic sentence from the lesson. If what's left is one fact with decorative wording ("X, because Y" where Y is just restating or lightly rephrasing X, not an independent second fact), it's a concept wearing a lesson's clothes — drop it or send it to concept-extraction instead.
- **Too generic:** would this lesson read identically if pasted into an unrelated source on the same general topic (a different SQL book, a different framework's docs)? If yes, it's a generic maxim, not a lesson from *this* source — tie it explicitly back to this source's specific mechanism/example, or drop it.

### 4. Show your work — don't blend quote and inference in one unflagged sentence

Every lesson cites the **specific facts/quotes it's built from** (plural), plus a short, mandatory `synthesis` note naming the relationship connecting them (e.g. "mechanism → consequence," "trade-off between X and Y," "comparison across the three algorithms"). This note is required for every lesson, not only borderline ones — it's what makes the lesson auditable instead of just plausible-sounding.

### 5. State coverage

Note what the lesson set covers, what was left out, and why the count is what it is. "One lesson per fact" is the wrong target — aim for one lesson per genuine mechanism+consequence or trade-off the source makes, however many that turns out to be.

### 6. Default JSON schema

Unless the user specifies otherwise:

```json
{
  "source": {"title": "...", "location": "...", "retrieved": "YYYY-MM-DD"},
  "focus": "... or null",
  "lessons": [
    {
      "lesson": "the teaching, phrased as an applied takeaway, not a definition",
      "built_from_quotes": ["quote A", "quote B"],
      "synthesis": "the relationship connecting the quotes (cause→effect / trade-off / comparison)"
    }
  ],
  "coverage_note": "what's included / excluded and why the count is what it is"
}
```

### 7. Save to an explicit location

State (or ask) where the JSON should live — don't silently default to a temp/scratch path if the user will need this again.

## Common Mistakes

| Mistake | Fix |
|---|---|
| A "lesson" that's really one fact with a decorative framing sentence | Apply the synthesis test: needs ≥2 independently-grounded facts and a real relationship |
| A lesson generic enough to fit almost any similar source | Tie it to this source's specific mechanism/example, or drop it |
| Blending a cited quote with your own inference in one sentence, unflagged | Separate: `built_from_quotes` for cited fact, `synthesis` for the (flagged) connecting logic |
| Dismissing a comparison across the source's own sub-cases as "not a real lesson" | Comparisons across the source's own cases are valid synthesis |
| No stopping rule, lesson count feels arbitrary | State coverage and what "enough" meant for this source |
| Silently saving to scratch/temp | State or ask the real destination |

## Quick Reference

1. Get real content, never infer from title → 2. Apply focus if given → 3. Synthesis test (≥2 facts, not generic) on every lesson → 4. Cite quotes + mandatory synthesis note → 5. State coverage → 6. Default schema unless told otherwise → 7. Save somewhere durable
