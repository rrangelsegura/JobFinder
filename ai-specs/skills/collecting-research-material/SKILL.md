---
name: collecting-research-material
description: Use when the user asks to gather, collect, or curate study or research material on a topic — searching across multiple formats (articles, videos, PDFs, podcasts, .md notes, datasets) rather than doing a single web search
---

# Collecting Research Material

## Overview

Build a curated, verified index of study material on a topic the user names — as narrow or broad as they state it. The deliverable is one consistent manifest, not an ad-hoc pile of links.

## When to Use

- User asks to "collect", "gather", "find material/resources", or "research" a topic for study
- Multiple source formats are in scope (not just "find me one article")

Not for: answering a factual question directly (just answer it), or a single specific known source (just fetch it).

## Workflow

### 1. Fix scope before searching

If quantity, depth, output location, or "links vs. downloaded copies" isn't stated, ask one tight clarifying question. If you can't ask (batch/non-interactive), state the assumptions you're making at the top of the final report — never guess silently.

Default (unless told otherwise): produce a **curated bibliography** (metadata + links), not bulk-downloaded files. Downloading arbitrary PDFs/videos has storage and licensing implications the user should opt into.

### 2. Adapt breadth to topic specificity

- Broad topic ("machine learning") → cover more subtopics/angles, moderate depth each.
- Narrow topic ("the CAP theorem in distributed databases") → fewer sources, more depth each.

State which mode you used in the report.

### 3. Search every applicable format — but don't force-fit

Check systematically: articles/URLs, PDFs, videos, podcasts, `.md` notes/guides, structured datasets (`.json`/similar).

If a format genuinely has no natural material for this topic (e.g. no one publishes tutorials as raw JSON), say **"none found for this format"** explicitly. Do not launder a bad match into the slot — a blog post about podcasting is not a podcast episode. Mislabeled items are worse than an honest gap.

### 4. Verify a disclosed sample, don't just trust snippets

Actually fetch and read enough sources to catch wrong labels and dead/misleading results — at minimum the top item per format. State your sampling rule (e.g. "verified top 2 per category, rest from search snippets") so the reader knows what's checked vs. not.

Tag every entry `verified` or `unverified`. Never mark something verified you only saw a snippet of. If a fetch returns no real content (blocked, JS-only shell, boilerplate only), that's `unverified` — don't infer content from the title alone.

### 5. Produce one manifest, in the user's language, consistently

Single index file, all entries same schema, one language throughout for your own prose — descriptions, headers (match the request's language). Keep titles and proper nouns (source names, paper/video titles) in their original language; don't translate them.

```json
{
  "type": "video | pdf | podcast | url | md | json",
  "title": "...",
  "source": "...",
  "location": "https://... or file path",
  "description": "one line",
  "verified": true
}
```

Group by type when presenting to the user; keep the underlying data flat and uniform.

### 6. Save to an explicit location

State (or ask) where the manifest should live — don't default to a temp/scratch path if the user will need this again. A repo-relative path or a location the user names is expected for real (non-test) runs.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Forcing a weak match into a required format slot | Report "none found for [format]" instead |
| Tagging something verified after only reading a search snippet | Only mark verified after actually fetching it |
| Picking quantity/depth with no stated rule | Adjust to topic specificity, state the rule used |
| Different files/sections in different languages | One language throughout, matching the request |
| Saving straight to a scratch/temp path by default | Ask or use a location meant to persist |
| Silently guessing scope instead of asking | Ask one question, or state assumptions up front |

## Quick Reference

1. Fix scope (ask or state assumptions) → 2. Pick breadth mode from topic specificity → 3. Search all formats, no force-fits → 4. Verify a disclosed sample → 5. One consistent manifest → 6. Save somewhere durable
