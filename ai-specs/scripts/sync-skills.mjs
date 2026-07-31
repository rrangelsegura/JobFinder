#!/usr/bin/env node
// Mirrors ai-specs/skills/* into each agent's skills folder by copying, not
// symlinking: Windows checkouts without Developer Mode / core.symlinks=true
// silently turn symlinks into plain text files containing the target path,
// which breaks skill discovery. Copies are always fully replaced from the
// canonical source, so mirrors never drift and edits belong in ai-specs/skills.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CANONICAL_DIR = path.join(ROOT, 'ai-specs', 'skills');
const MIRROR_DIRS = ['.claude/skills', '.cursor/skills'].map((p) => path.join(ROOT, p));

function listCanonicalSkills() {
  return fs
    .readdirSync(CANONICAL_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .filter((e) => fs.existsSync(path.join(CANONICAL_DIR, e.name, 'SKILL.md')))
    .map((e) => e.name);
}

function syncMirror(mirrorDir, skillNames) {
  fs.mkdirSync(mirrorDir, { recursive: true });

  const copied = [];
  for (const name of skillNames) {
    const src = path.join(CANONICAL_DIR, name);
    const dest = path.join(mirrorDir, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
    copied.push(name);
  }

  const external = fs
    .readdirSync(mirrorDir, { withFileTypes: true })
    .map((e) => e.name)
    .filter((name) => !skillNames.includes(name));

  return { copied, external };
}

function main() {
  const skillNames = listCanonicalSkills();
  console.log(`Canonical skills (${skillNames.length}): ${skillNames.join(', ')}`);

  for (const mirrorDir of MIRROR_DIRS) {
    const relMirror = path.relative(ROOT, mirrorDir);
    const { copied, external } = syncMirror(mirrorDir, skillNames);
    console.log(`\n${relMirror}`);
    console.log(`  copied: ${copied.length}`);
    if (external.length) {
      console.log(`  left untouched (not in ai-specs/skills): ${external.join(', ')}`);
    }
  }
}

main();
