import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "build_council.py"
EXPECTED_COMMANDS = {
    "setup", "council", "consult", "new-initiative", "log",
    "status", "evaluate-initiative", "weekly-review", "self-review",
}


def run_build(target, *extra):
    return subprocess.run(
        [sys.executable, "-I", str(SCRIPT), str(target), *extra],
        capture_output=True, text=True, check=True,
    )


def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    assert text.startswith("---\n"), f"{path} has no frontmatter"
    head = text[4:].split("\n---\n", 1)[0]
    return dict(line.split(":", 1) for line in head.splitlines() if ":" in line)


class BuildCouncilTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.target = Path(self._tmp.name) / "council"
        run_build(self.target)

    def test_generates_sixteen_valid_agents(self):
        agents = sorted((self.target / ".claude/agents").glob("*.md"))
        self.assertEqual(len(agents), 16)
        for path in agents:
            meta = frontmatter(path)
            self.assertEqual(meta["name"].strip(), path.stem)
            for key in ("description", "tools", "model"):
                self.assertTrue(meta[key].strip(), f"{path.name} missing {key}")
            self.assertNotIn("Agent", meta["tools"])

    def test_generates_all_commands(self):
        found = {p.stem for p in (self.target / ".claude/commands").glob("*.md")}
        self.assertEqual(found, EXPECTED_COMMANDS)
        for name in EXPECTED_COMMANDS:
            self.assertTrue(frontmatter(self.target / f".claude/commands/{name}.md")["description"].strip())

    def test_commands_reference_only_existing_agents(self):
        slugs = {p.stem for p in (self.target / ".claude/agents").glob("*.md")}
        manual = (self.target / "CLAUDE.md").read_text(encoding="utf-8")
        listed = set(re.findall(r"^\| `([a-z-]+)` \|", manual, flags=re.M))
        self.assertEqual(listed, slugs)

    def test_scorecard_covers_ten_responsibilities(self):
        scorecard = (self.target / "performance/scorecard.md").read_text(encoding="utf-8")
        for n in range(1, 11):
            self.assertIn(f"| R{n} |", scorecard)

    def test_language_option_is_applied(self):
        other = Path(self._tmp.name) / "pt"
        run_build(other, "--lang", "Portuguese")
        agent = (other / ".claude/agents/competitive-intelligence.md").read_text(encoding="utf-8")
        self.assertIn("Portuguese", agent)
        self.assertNotIn("@@LANG@@", agent)

    def test_rerun_preserves_user_data_and_force_refreshes_managed(self):
        me = self.target / "context/me.md"
        me.write_text("MY PRIVATE NOTES", encoding="utf-8")
        agent = self.target / ".claude/agents/bi-dashboards.md"
        agent.write_text("tampered", encoding="utf-8")

        run_build(self.target)
        self.assertEqual(me.read_text(encoding="utf-8"), "MY PRIVATE NOTES")
        self.assertEqual(agent.read_text(encoding="utf-8"), "tampered")

        run_build(self.target, "--force")
        self.assertEqual(me.read_text(encoding="utf-8"), "MY PRIVATE NOTES")
        self.assertIn("name: bi-dashboards", agent.read_text(encoding="utf-8"))

    def test_data_dir_is_gitignored(self):
        self.assertIn("data/", (self.target / ".gitignore").read_text(encoding="utf-8").splitlines())


class MiCliTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.target = Path(self._tmp.name) / "council"
        run_build(self.target)
        self.env = {**os.environ, "MI_TODAY": "2026-10-28"}

    def mi(self, *args, check=True):
        return subprocess.run(
            [sys.executable, "-I", str(self.target / "tools/mi.py"), *args],
            capture_output=True, text=True, check=check, env=self.env,
        )

    def test_new_assigns_sequential_ids_and_validates(self):
        first = self.mi("new", "--title", "Peru institutional share", "--jd", "R1,R4", "--priority", "P1")
        second = self.mi("new", "--title", "Data quality audit", "--jd", "R10")
        self.assertIn("INI-001", first.stdout)
        self.assertIn("INI-002", second.stdout)
        self.assertTrue(list((self.target / "initiatives").glob("INI-001-peru-institutional-share.md")))
        bad = self.mi("new", "--title", "x", "--jd", "R99", check=False)
        self.assertEqual(bad.returncode, 2)

    def test_list_flags_overdue_and_stale(self):
        self.mi("new", "--title", "Late one", "--jd", "R6", "--due", "2026-10-01")
        self.mi("set", "INI-001", "status", "in_progress")
        listing = self.mi("list")
        self.assertIn("OVERDUE", listing.stdout)
        self.env["MI_TODAY"] = "2026-11-30"
        self.assertIn("STALE", self.mi("list").stdout)

    def test_set_validates_status_and_bumps_updated(self):
        self.mi("new", "--title", "Dash", "--jd", "R6")
        self.assertEqual(self.mi("set", "INI-001", "status", "nonsense", check=False).returncode, 2)
        self.env["MI_TODAY"] = "2026-11-02"
        self.mi("set", "INI-001", "status", "blocked")
        text = next((self.target / "initiatives").glob("INI-001-*.md")).read_text(encoding="utf-8")
        self.assertIn("status: blocked", text)
        self.assertIn("updated: 2026-11-02", text)

    def test_log_writes_journal_and_initiative_log_section(self):
        self.mi("new", "--title", "Dash", "--jd", "R6")
        self.mi("log", "Agreed KPI dictionary with Finance", "--type", "decision", "--initiative", "INI-001")
        journal = (self.target / "journal/2026-10.md").read_text(encoding="utf-8")
        self.assertIn("2026-10-28 [decision] (INI-001) Agreed KPI dictionary with Finance", journal)
        text = next((self.target / "initiatives").glob("INI-001-*.md")).read_text(encoding="utf-8")
        log_section = text.split("## Log", 1)[1].split("\n## ", 1)[0]
        self.assertIn("Agreed KPI dictionary with Finance", log_section)

    def test_list_json_is_machine_readable(self):
        import json
        self.mi("new", "--title", "Dash", "--jd", "R6")
        data = json.loads(self.mi("list", "--json").stdout)
        self.assertEqual(data[0]["id"], "INI-001")


if __name__ == "__main__":
    unittest.main()
