---
name: sync-agent-symlinks
description: Analyze and synchronize agent skill exposure after ai-specs skill changes (additions, removals, renames). Use when skills are added/removed in ai-specs and .claude/skills and .cursor/skills must stay aligned via the copy-based sync script.
author: LIDR.co
version: 2.0.0
---

# sync-agent-symlinks Skill

Keep agent-facing skill structures synchronized with `ai-specs/skills` as the canonical source.

Use this skill after any change in `ai-specs/skills` (new skill, removed skill, renamed skill, moved skill).

Mirrors are plain copies, not symlinks. Windows checkouts without Developer Mode (or with `core.symlinks=false`) silently turn symlinks into text files containing the target path, which breaks skill discovery for the whole team. Copying avoids that failure mode entirely, at the cost of needing an explicit sync step whenever `ai-specs/skills` changes.

## Scope and Safety Rules

- Canonical source is `ai-specs/skills`.
- Mirror targets are:
  - `.claude/skills`
  - `.cursor/skills`
- The sync script owns only entries whose name matches a canonical skill in `ai-specs/skills`; it always deletes and recopies those so mirrors exactly match the source.
- Entries in a mirror with no canonical counterpart (e.g. `openspec-*`, provisioned by the `openspec` CLI) are left untouched.
- The script never deletes orphans (mirror copies whose canonical skill was removed) automatically — it has no way to distinguish a synced copy from a manually placed directory. Report orphans and let the user confirm removal.

## Workflow

### Step 1 - Run the sync script

```bash
node ai-specs/scripts/sync-skills.mjs
```

This recopies every canonical skill into `.claude/skills` and `.cursor/skills`, and prints, per mirror, how many skills were copied and which entries were left untouched as external.

### Step 2 - Check for orphans

Compare mirror entries against `ai-specs/skills/*/SKILL.md`. Any mirror entry that is not canonical and not a known external tool (`openspec-*`) is a candidate orphan — a skill that was removed from `ai-specs/skills` but whose copy is still sitting in a mirror. Report it; do not delete without confirmation.

### Step 3 - Report results

Return a concise sync report:
- Canonical skills count
- Per mirror target: copied count, external entries left untouched
- Any orphan candidates found, with a recommendation to confirm before deleting

## Add/Remove Scenarios

### Scenario A - New skill added in ai-specs

Running the script picks it up automatically: it appears in the canonical listing and gets copied into both mirrors.

### Scenario B - Skill removed from ai-specs

The script does not remove the old copy from `.claude/skills` / `.cursor/skills` (see Step 2). Delete it manually in both mirrors once confirmed:

```bash
rm -rf .claude/skills/<skill-name>
rm -rf .cursor/skills/<skill-name>
```

## Red Flags

Never:
- treat `ai-specs` as non-canonical
- auto-delete a mirror entry without confirming it's an orphan, not an external tool directory
- edit a mirror copy directly — edits belong in `ai-specs/skills/<skill-name>` and get overwritten on the next sync
- silently skip external entries without reporting them

Always:
- run `node ai-specs/scripts/sync-skills.mjs` after any change under `ai-specs/skills`
- treat mirror copies as generated output, not source
- provide a final sync report with blockers
