## Why

Real-world manual testing (a genuine 5-page CV, exported from Word to PDF) surfaced problems no synthetic fixture ever caught: the extraction pipeline was only ever validated against 1-page CVs with 1-2 items per list, and the whole upload UI — every form input across login, register, and upload — uses raw unstyled HTML `<input>` despite Shadcn/UI being set up from day one. The result: extraction fails outright on realistic CVs, the UI looks unfinished, and a failure that's genuinely JobFinder's bug tells the candidate to just "try again" as if it were their fault.

## What Changes

- **cv-extraction reliability**: fix two real, root-caused failure modes found via a live debugging session against actual Ollama/backend-agent logs:
  1. Long skill/language lists (14 skills, 2 languages) make the LLM revert to flat strings instead of the required `{name, type}`/`{name, proficiency}` objects — the single worked example in the prompt only shows 1-2 items per list.
  2. The retry prompt duplicates the full resume text, appends the full previous (malformed) output, and the full validation error list, with no explicit `num_ctx` set — for a real multi-page CV this can exceed Ollama's default 2048-token context window, causing total output collapse (`personal_info` missing entirely), observed for real.
- **Honest failure messaging**: any CV-extraction job failure (OCR or LLM schema validation, both post-upload — file-level problems like wrong type/size/corruption are already caught earlier and are genuinely user-fixable) is JobFinder's problem, not the candidate's file. The UI stops telling the candidate to "try again" for these and instead says a fix is in progress; the candidate additionally gets a one-shot email acknowledging the same.
- **Professional form UI**: every real form input (login, register, CV upload) gets Shadcn/UI's actual `Input`/`Label`/`Card` components (installed but never used past `Button`) instead of raw unstyled `<input>` — visible borders included, not just implied by them.

## Capabilities

### Modified Capabilities
- `cv-extraction`: the LLM prompt SHALL reinforce structured-object shape regardless of list length, and the retry prompt SHALL stay within the model's context budget instead of naively concatenating full prior content.
- `cv-upload-ui`: form inputs SHALL use the project's actual design system (visible bordered fields, consistent styling) instead of unstyled native elements; a system-side extraction failure SHALL be communicated as JobFinder's issue, never as something the candidate should retry on their own, and SHALL trigger a one-shot acknowledgment email.

## Impact

- **Backend (Python agent)**: `backend/agents/cv_analyst/extraction_service.py` — prompt construction for both the initial and retry attempts.
- **Backend (Node API)**: `backend/api/index.ts`'s BullMQ `'failed'` handler — send the one-shot "we're on it" email on job failure; `backend/api/lib/emailService.ts` — new email template.
- **Frontend**: `frontend/src/features/auth/{LoginPage,RegisterPage}.tsx`, `frontend/src/features/upload/{CvUploadForm,UploadStatusIndicator,errorMessages}.ts(x)` — Shadcn `Input`/`Label`/`Card` adoption; corrected failure copy.
- **Docs**: none required beyond code comments — this is a reliability/UX correction to already-documented behavior, not a new documented contract.
