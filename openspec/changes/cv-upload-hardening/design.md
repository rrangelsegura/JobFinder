## Context

A real 5-page CV (Word → PDF export, 14 skills, 2 languages, 4 work experiences) was manually uploaded through the live stack. It failed extraction. Live debugging against actual `docker logs infra-backend-agent-1` output (not speculation) found two distinct, root-caused problems in `backend/agents/cv_analyst/extraction_service.py`:

1. First LLM attempt: `skills`/`languages` came back as flat strings (`'PL/pgSQL'`, `'Spanish (native)'`) instead of the required `{name, type}`/`{name, proficiency}` objects, plus a missing `work_experience.3.start_date`. The prompt's single worked example (`_EXAMPLE_RESULT`) shows only 2 skills and 1 language — nowhere near this CV's 14 and 2 with a longer tail.
2. Retry attempt: total collapse — `personal_info` (a required field) came back entirely missing (`{}`). `_build_retry_prompt` concatenates the full resume text, the full previous (large, malformed) output, and the full Pydantic validation error (~20 lines for this CV) — with `_call_ollama` never setting `options.num_ctx`, Ollama defaults to **2048 tokens** even though llama3:8b's architecture supports up to 8192. A 5-page CV's OCR text alone, duplicated plus that much extra content, plausibly exceeds 2048 tokens, and the failure pattern (total field loss, not "still the wrong shape") matches context truncation rather than continued confusion.

Separately, the same manual test exposed that every real form input in the app (login, register, CV upload) is a raw unstyled `<input>` — Shadcn/UI's `Input`/`Label`/`Card` components were installed during `candidate-workspace` but only `Button` was ever actually used — and that a genuinely internal failure (OCR/LLM) told the candidate to "try again," which is dishonest: retrying does nothing until the actual bug is fixed.

## Goals / Non-Goals

**Goals:**
- Make the extraction prompt robust to realistic list lengths and keep the retry prompt within the model's context budget.
- Give every real form input actual visible borders and consistent styling via the design system already set up.
- Stop telling candidates to retry a failure that's JobFinder's bug, not theirs; acknowledge it honestly and confirm they'll hear back.

**Non-Goals:**
- A full visual redesign (color palette, typography system, spacing scale) beyond adopting the already-chosen Shadcn/UI components consistently. `docs/frontend-standards.md`'s "Clean & Utilitarian... Slate/Zinc/Indigo" direction and the existing `radix-nova` Shadcn preset are not being re-litigated here.
- Automatically detecting when the underlying bug is actually fixed and sending a second "you can retry now" email. That needs a retry-queue and a way to correlate a specific failed job with a specific deploy/fix — real infrastructure disproportionate to this change. What ships now is the honest acknowledgment (one email, sent immediately on failure) that a fix is being worked on. Follow-up notification is a known, explicitly flagged gap (see Risks), not something silently promised and left unbuilt.
- Redesigning `Education`/`WorkExperience`/etc. to be resume-scoped (already flagged as a separate known gap in `candidate-authentication`'s design.md).

## Decisions

### 1. Prompt fix: an explicit length-invariant instruction + a longer worked example, not just "try harder"

Add an explicit instruction that the structured shape applies "no matter how many items are in a list" directly adjacent to the skills/languages instructions, and extend `_EXAMPLE_RESULT` to include 4-5 skills (still small enough to stay token-cheap, but enough to demonstrate the pattern holding across repetition, not just a single instance).

**Alternative considered**: switch to a stricter output mode (e.g. JSON Schema-constrained decoding via Ollama's `format` parameter with a full schema instead of `"json"`). Rejected for this change — `format: "json"` combined with a worked example is the existing, already-debugged approach (a prior real bug — nested `skills` objects — was fixed by moving from a raw schema dump to a worked example); switching output-constraint mechanisms is a bigger, separately-risky change better done as its own spike if the example-based approach still isn't reliable enough after this fix.

### 2. Retry prompt: cap what gets re-sent, and set `num_ctx` explicitly

- `_call_ollama` passes `options: {"num_ctx": 8192}` explicitly (the model's actual architectural limit) on both the initial and retry calls, instead of relying on Ollama's 2048-token default.
- `_build_retry_prompt` no longer includes the full previous (malformed) output — the model doesn't need to see its own wrong answer to fix it, only what was wrong. It also caps the validation error text (e.g. first N distinct errors, deduplicated by error type, rather than one line per list item) so a resume with many skills doesn't produce a proportionally huge error dump.
- The resume text itself is still included once (extraction requires it), not duplicated.

**Alternative considered**: chunk the resume text and extract section-by-section. Rejected for this change — a real architecture change to the extraction flow, and `num_ctx: 8192` plus a leaner retry prompt is very likely suffi­cient headroom for CVs in the size range actually being tested (5 pages); revisit only if a genuinely longer CV still overflows.

### 3. Failure classification: file-level vs. system-level is already structurally separate — no new classification logic needed

`backend/api/routes/uploads.ts` already rejects file-level problems (wrong type, oversized, corrupted) synchronously at upload time, before any BullMQ job is ever enqueued — those never reach a job `'failed'` event. Therefore **every** BullMQ `cvExtractionQueue` job failure is, by construction, a system-side problem (OCR or LLM). The existing `worker.on('failed', ...)` handler in `backend/api/index.ts` (currently just `console.error`) is the single place to add the acknowledgment email — no new error-type field or classification code needed.

Frontend-side, `errorMessages.ts`'s existing substring-matched entries for `"OCR failed"`, `"schema validation"`, and the generic fallback are exactly the system-side cases (the file-level ones — `"Unsupported file type"`, `"exceeds the maximum allowed size"`, `"unreadable or corrupted"` — stay as user-fixable, unchanged). Only the copy for the system-side entries changes.

### 4. Form styling: adopt Shadcn `Input`/`Label`/`Card`, don't hand-roll

`npx shadcn add input label card` (matching the same `radix-nova` preset already configured in `components.json`), then replace every raw `<input>`/`<label>` in `LoginPage`, `RegisterPage`, and `CvUploadForm` with the generated components, wrapping each form in `Card`/`CardContent` for visual structure. This is adoption of what's already set up, not a new design decision.

## Risks / Trade-offs

- **[Risk]** `num_ctx: 8192` increases per-request memory/compute on the Ollama side. → **[Mitigation]** This is the model's own supported context length, not an artificial stretch; acceptable for a local single-user dev/eval setup. Worth watching if this ever runs under real concurrent load.
- **[Risk]** The "you'll be notified once resolved" promise in the failure email is not backed by an automated second notification (see Non-Goals). A candidate could wait indefinitely without hearing back if nobody manually follows up. → **[Mitigation]** Explicitly documented here as a known gap, not hidden; a future change can add real retry-tracking if this proves to matter in practice.
- **[Risk]** Extending the worked example to more skills increases prompt token cost on every extraction call, not just failing ones. → **[Mitigation]** A handful of extra skill entries is a small, fixed cost against the `num_ctx: 8192` budget; worth it if it prevents most long-list failures from needing a retry at all.

## Migration Plan

No data migration. Deploy order: backend agent prompt/context fix and Node email-on-failure handler ship together (the email handler is meaningless without a failure to react to, but doesn't depend on the prompt fix being perfect — failures can still legitimately happen). Frontend styling and copy changes are independent and can ship in the same PR without sequencing concerns.

## Open Questions

None — this change directly implements a live-debugged root cause plus three explicitly user-specified requirements; no unresolved design questions remain.
