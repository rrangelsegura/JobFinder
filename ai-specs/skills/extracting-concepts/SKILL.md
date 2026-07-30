---
name: extracting-concepts
description: Use when the user asks to extract key concepts, terms, or definitions from a source (video, PDF, podcast, URL, .md, .json, or similar) into a structured list
---

# Extracting Concepts

## Overview

Turn one source into a JSON list of atomic concepts and their meaning, each grounded in a real quote from the source — not a paraphrase-only summary with an arbitrary concept count.

## When to Use

- User names one source and wants its key concepts/terms extracted with definitions
- Output should be structured (JSON), not prose

Not for: condensing a source into a narrative reference doc (that's a different shape of output), or extracting from many sources at once (do one source per run unless told otherwise).

## Workflow

### 1. Get the real content

Same rule as any source-processing task: never infer concepts from the title alone. Use real transcript/text extraction (captions for video/podcast, actual text for PDF/URL/.md/.json). If extraction fails, say so — don't fill the list with concepts from general knowledge of the topic instead of the actual source.

### 2. Apply the focus, if given

If the user names a focus/angle, organize and emphasize the outcome around it — but don't invent connections the source itself doesn't make just to fit that focus. No focus given → condense for general, complete coverage of the source.

### 3. Apply the atomicity test to each concept

A concept is atomic when it's a single, independently-statable claim: it doesn't need another concept in the list to make sense, and splitting it further would produce fragments that are meaningless alone.

- **Too coarse:** a "concept" that bundles two or more separately-useful claims someone might look up independently.
- **Too fine:** splitting one claim into pieces that only make sense stitched back together (e.g. don't split "sliding window frame" into "sliding," "window," and "frame" as three concepts).

State which granularity you used if it's a judgment call, so the reader can push back on it.

### 4. Ground every concept in a real quote — flag interpretation

Every concept needs a `source_quote` pulled from the actual fetched/read text. No traceable quote → don't include the concept.

Your `definition` field is a paraphrase for readability, which is fine — but if it adds a generalization, synonym, or interpretation beyond what the quote literally says, mark it (`"faithful": false` or a short note). Don't present an interpretive leap as if it were a verbatim restatement.

### 5. Do a real dedup pass

After a first extraction pass, do a **second pass** specifically to find overlapping/duplicate concepts (the same fact stated under two different labels). Merge them, or if you keep both, state why they're genuinely distinct.

### 6. State coverage

Note what the concept list covers and what you deliberately left out (tangential material, content on other pages/sections, implementation-specific noise) — a bare count with no scope statement leaves the reader unable to tell "complete" from "sampled."

### 7. Default JSON schema

Unless the user specifies a different schema:

```json
{
  "source": {"title": "...", "location": "...", "retrieved": "YYYY-MM-DD"},
  "concepts": [
    {"concept": "...", "definition": "...", "source_quote": "...", "faithful": true, "faithful_note": "only present when faithful is false — explain the specific interpretive gap"}
  ],
  "coverage_note": "what's included / excluded and why"
}
```

### 8. Save to an explicit location

State (or ask) where the JSON should live — don't silently default to a temp/scratch path if the user will need this again.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Splitting/merging concepts with no stated rule, count varies wildly run to run | Apply the atomicity test explicitly, state the granularity used |
| A definition with no traceable quote behind it | Every concept needs a `source_quote`; drop it if you can't ground it |
| Presenting an interpretive generalization as if it were verbatim | Flag it (`faithful: false` / note) instead of hiding the gap |
| Skipping the dedup pass | Always do a dedicated second pass for overlap before finalizing |
| No statement of what's covered vs. excluded | Add a coverage note |
| Silently saving to scratch/temp | State or ask the real destination |
| Ignoring a stated focus, or forcing concepts to fit one that wasn't given | Only emphasize a focus the user actually gave |

## Quick Reference

1. Get real content, never infer from title → 2. Apply focus if given → 3. Apply the atomicity test → 4. Ground every concept in a quote, flag interpretation → 5. Dedicated dedup pass → 6. State coverage → 7. Default schema unless told otherwise → 8. Save somewhere durable
