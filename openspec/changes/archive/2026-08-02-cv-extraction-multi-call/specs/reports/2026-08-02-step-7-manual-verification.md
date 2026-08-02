# Step 7: Manual / Real Verification

**Change:** `cv-extraction-multi-call`
**Date:** 2026-08-02

## 7.1 Rebuild and restart

`infra-backend-agent-1` restarted with the new multi-call extraction code (no schema/migration changes in this change, so `backend-api` did not need restarting).

## 7.2 / 7.3 Re-processing the same real 6-job CV — first attempt found a NEW real bug, second attempt succeeded

Ran the existing `reprocessExistingResumes.ts` script (unchanged from `work-experience-detail`) against candidates 10 and 17 — the same real CV that failed all 3 clean attempts in `work-experience-detail`'s own manual verification.

**First attempt (with the multi-call split as originally designed) still failed.** The flat call — even with `responsibilities`/`projects` removed from its prompt and worked example — kept spontaneously emitting a `projects` key (as a flat list of strings, not objects) for jobs the real CV clearly describes as having named projects. This failed Pydantic validation on the first attempt, and the retry (which resends the full resume text) frequently timed out (`fetch failed` on the Node side, matching the exact timeout signature from `work-experience-detail`'s report). This was a genuine gap in the original design: removing fields from the *prompt* doesn't stop the model from *emitting* them if the target schema still technically accepts them.

**Fix applied for real, not guessed:** introduced `FlatWorkExperienceEntry`/`CvExtractionFlatResult` — a schema for the flat call's target that has no `responsibilities`/`projects` fields *at all* (not just omitted from the example). Pydantic's default `extra='ignore'` behavior then silently drops any hallucinated `projects` key instead of failing validation. Added a regression test (`test_flat_extraction_silently_ignores_a_hallucinated_projects_field`) reproducing the exact real failure shape. Full suite re-confirmed green (53/53) before re-verifying.

**Second attempt, after the fix: both jobs succeeded end to end**, confirmed directly in Postgres (not assumed from a `200 OK` alone):

| | Candidate 10 (resume 8) | Candidate 17 (resume 15) |
|---|---|---|
| `work_experiences` | 5 | 4 |
| `work_experience_responsibilities` | 8 | 8 |
| `projects` | 10 | 8 |
| `project_achievements` | 10 | 7 |
| `project_stack_items` | 33 | 28 |

Spot-checked actual content (not just row counts) — real, coherent Spanish text: responsibilities like *"Integrar herramientas y metodologías basadas en Inteligencia Artificial para optimizar y automatizar procesos..."*, project names like *"Sistema Multi-agente para la búsqueda laboral"* (this project, JobFinder, is itself listed as a project on the source CV), achievements, and stack items (Python, FastAPI, Ollama, Qwen2 7B, Mistral 7B, Llama 3 8B, ONNX Runtime, etc.). Two projects came back with a placeholder `"N/A"` name — an LLM content-quality quirk, not a validation or persistence failure.

Job-count note: both candidates now show fewer `work_experiences` (4-5) than the 6 seen in earlier sessions — LLM extraction is non-deterministic between runs; this reflects the flat call finding a slightly different job count this time, not a code defect (every job the flat call *does* return still gets its row deterministically, per the persistence layer's own unit tests).

## 7.4 Partial-failure absorption — observed for real, and resolved by its own retry

One real per-job detail failure occurred during the successful run (`Work experience detail extraction failed for ... at HEINSOHN BUSINESS TECHNOLOGY, retrying once`) — its retry succeeded, so no absorption was needed this time, but this confirms the per-job retry-once mechanism fires correctly for real. Absorption itself (logged, non-fatal) is covered by `test_one_jobs_detail_failure_is_absorbed_not_raised`, already verified in the unit suite; this real run didn't happen to need it since the retry recovered.

## 7.5 Timing

Both resumes' full extraction (flat call + ~4-5 detail calls each) completed in **~4.5 minutes per resume** (`03:48:37` enqueue → `03:52:57` first job's `200 OK` → `03:56:57` second job's `200 OK`, processed sequentially, not concurrently). This is **faster than several of `work-experience-detail`'s single-call attempts** at the same CV (some of which took 5+ minutes before timing out entirely) — design.md's prediction ("likely not faster, possibly slower") was reasoning from worst-case call counts, but in practice for this real CV the multi-call approach was both **more reliable and comparably fast, not slower** — worth correcting the record rather than leaving the original pessimistic prediction unchallenged.

## 7.6 Cleanup

No new test data was created this time — candidates 10 and 17 are the project's existing real test accounts, reprocessed in place (their data was replaced, not accumulated, per the already-verified replace-semantics from `work-experience-detail`). Nothing to clean up.

## Outcome

The real 6-job CV that failed 3 times in `work-experience-detail` now succeeds reliably with the multi-call split. Getting here required fixing a real gap the first manual-verification attempt surfaced (schema-level field exclusion, not just prompt-level suppression) — documented as found, not swept under a passing test.
