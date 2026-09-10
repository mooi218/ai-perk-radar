import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ProtocolTests(unittest.TestCase):
    def test_raw_utf8_survives_local_codepage_and_bad_request_does_not_kill_process(self):
        catalog = (ROOT / "ai_perk_radar/opportunities.json").read_text(encoding="utf-8")
        args = {"catalog_json": catalog, "country": "JP", "student": True, "researcher": False,
                "developer": True, "creator": False, "founder": False, "limited_only": False,
                "priority": "free", "interests": ["coding", "ai", "cloud"]}
        request = {"jsonrpc": "2.0", "id": 3, "method": "invoke", "params": {"tool": "find_perks", "arguments": args}}
        wire = "{invalid json}\n[]\n" + json.dumps(request, ensure_ascii=False) + "\n"
        result = subprocess.run([sys.executable, str(ROOT / "ai_perk_radar_plugin.py")], input=wire,
                                text=True, encoding="utf-8", capture_output=True, timeout=15,
                                env={**os.environ, "PYTHONIOENCODING": "cp932"}, check=True)
        replies = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(replies[0]["error"]["code"], -32700)
        self.assertEqual(replies[1]["error"]["code"], -32600)
        self.assertTrue(replies[2]["result"]["success"])
        codedex = next(p for p in replies[2]["result"]["data"]["results"] if p["id"] == "github-pack-codedex")
        self.assertEqual(codedex["title"], "Codédex Club Student")
        self.assertIn("学生", codedex["localizations"]["ja"]["reason"])


if __name__ == "__main__":
    unittest.main()
