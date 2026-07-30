---
name: condensing-knowledge
description: Use when the user asks to condense, distill, or summarize a single named source (video, PDF, Word doc, podcast, URL, .md, .json, or a source picked from a JSON list of sources) into a reference document
---

# Condensing Knowledge

## Overview

Turn one named source into a faithful, well-organized reference document. The hard rule: never substitute real source content with a plausible-sounding guess based on the title.

## When to Use

- User names one source (path, URL, or something to search for) and wants a condensed reference doc from it
- User points at a JSON file of sources and picks — or asks you to pick — one entry to condense

Not for: condensing many sources into one doc in a single pass (do one source per run unless told otherwise), or open-ended research on a topic (that's gathering material, not condensing a known one).

## Workflow

### 1. Resolve the source

- Direct reference (path/URL/searchable name): resolve it, confirm it's the one meant.
- JSON file of sources: if exactly one entry matches a stated criterion (topic, focus, type), use it. If several could match and nothing disambiguates them, don't guess — ask which one. If you can't ask (batch run), pick the closest match, state which entry and why at the top of the report, and list the other candidates you didn't pick.

### 2. Get the REAL content — never infer from the title alone

Use every reasonable extraction method for the format before giving up: real transcript/captions for video/podcast (platform captions, `yt-dlp --write-auto-sub`, or similar — not just the title/description), actual text for PDF/Word/.md/.json/URL.

If extraction genuinely fails (paywalled, DRM, no captions, corrupt file), stop and say so explicitly. Do not write a plausible-sounding document from the title and general knowledge and present it as if it came from the source.

**No exceptions:** "the title is descriptive enough," "I already know this topic," "close enough" are not reasons to skip real extraction.

A page/chapter that returns only navigation links or a table of contents is real-but-thin content, not a failure — disclose it as thin rather than treating it as extraction failure or padding it with outside knowledge. If your extraction tool itself summarizes before returning text (e.g. a fetch tool that runs a small model over the page), treat what it returns as ground truth but note this as a source of possible paraphrase drift if exact quotes matter.

### 3. Apply the focus, if given

If the user names a focus/angle, organize and emphasize the condensed doc around it — but don't invent connections the source itself doesn't make just to fit that focus. No focus given → condense for general, complete coverage of the source.

### 4. Hit the size target without padding or dishonest cuts

Default: Markdown, ~1000–2000 lines, unless told otherwise.

- Source has less substantive content than the target → produce a shorter, honest document and say so (state the actual line count and why it's short). Padding with filler, restated points, or generic knowledge not in the source is worse than a short accurate document.
- Source has far more than fits → prioritize what's most relevant to the stated focus (or most central if none), and say explicitly what got compressed or left out.
- A different requested format/size overrides the default. If the requested format needs tooling you don't have (e.g. true .docx/.pdf generation), say so and fall back to Markdown rather than producing a broken file.

### 5. State extraction method and fidelity up front

Open the output with a short block: source, how the content was actually obtained (transcript/captions/full text/etc.), and any known gaps (e.g. "title promises X, source barely covers it").

### 6. Save to an explicit location

State (or ask) where the document should live — don't silently default to a temp/scratch path if the user will need this again.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing a plausible summary from the title when real content isn't accessible | Say extraction failed; never present inferred content as if it came from the source |
| Padding to hit the line-count target | Shorter and honest beats longer and full of filler |
| Guessing which entry from a multi-source JSON file to condense | Ask if ambiguous; if you can't ask, state the pick and why |
| Ignoring a stated focus, or forcing content to fit one that wasn't given | Only emphasize a focus the user actually gave |
| Silently saving to scratch/temp | State or ask the real destination |

## Quick Reference

1. Resolve source (ask if the JSON pick is ambiguous) → 2. Get real content, never infer from title → 3. Apply focus if given → 4. Hit the size target honestly → 5. State extraction method + fidelity up front → 6. Save somewhere durable
