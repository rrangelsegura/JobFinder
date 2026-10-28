# Market Intelligence Council Harness

Standalone tooling (not part of the JobFinder product runtime). `build_council.py` generates a
Claude Code workspace that acts as an advisory council plus a working copilot for a
**Market Intelligence Leader (Latin America, pharma generics, institutional channel)**.

## Specification

### Goals
1. **Strategy**: convene a council of domain experts on any question or decision.
2. **Management**: plan, log, evaluate and consult initiatives; self-assess performance against the job description.
3. **Portability**: one self-contained, stdlib-only Python script; the generated workspace is plain files (Markdown, one Python CLI).

### Functional requirements
| ID | Requirement |
|----|-------------|
| FR-1 | `python3 build_council.py <target>` creates the workspace; re-running never overwrites user data. |
| FR-2 | Generates 16 specialist subagents in `.claude/agents/`, each with valid frontmatter (`name`, `description`, `tools`, `model`). |
| FR-3 | Generates slash commands: `/setup`, `/council`, `/consult`, `/new-initiative`, `/log`, `/status`, `/evaluate-initiative`, `/weekly-review`, `/self-review`. |
| FR-4 | Generates `tools/mi.py` (`new`, `list`, `set`, `log`) to manage initiatives and the journal with consistent IDs and validated fields. |
| FR-5 | Generates `CLAUDE.md` (operating manual and Chair protocol), context templates, and a scorecard mapping the 10 job-description responsibilities (R1-R10). |
| FR-6 | `--force` refreshes only *managed* files (agents, commands, manual, CLI). User data (`initiatives/`, `journal/`, `reviews/`, `context/`) is never overwritten. |
| FR-7 | `--lang` sets the conversation language written into the agents and manual (default `Spanish`). |

### Design decisions
- **One agent per expertise area**, each reasoning through the published frameworks of several recognised authors ("lenses"). Agents never impersonate people or invent quotes.
- **The Chair is not a subagent**: subagents cannot spawn subagents, so the main session runs the protocol in `/council` (triage, parallel dispatch, red team, synthesis).
- **Experts are advisory and read-only** (`Read, Grep, Glob, WebSearch, WebFetch`); only the main session writes files.
- **Data stays local**: `data/` is git-ignored; agents are instructed to work with aggregates, never confidential raw data.
- Technical artifacts are English; the conversation language is configurable.

### Out of scope
Connecting to SISMED/RIPS/BDUA or any proprietary source; BI tooling; hosting.

## Usage

```bash
python3 tools/market-intel-council/build_council.py ~/market-intel-council --git
cd ~/market-intel-council && claude
# first session
/setup
/council Should we prioritise the institutional channel in Peru next year?
```

## Tests

```bash
python3 -m unittest discover -s tools/market-intel-council/tests -v
```
