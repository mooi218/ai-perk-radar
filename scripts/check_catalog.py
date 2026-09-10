"""Validate catalog-only edits without an app or Executa build."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXECUTA_ROOT = ROOT / "executas/ai-perk-radar"
sys.path.insert(0, str(EXECUTA_ROOT))
from catalog_validation import CATALOG_PATH, parse_catalog

if __name__ == "__main__":
    catalog, digest = parse_catalog((EXECUTA_ROOT / CATALOG_PATH).read_text(encoding="utf-8"))
    print(f"Catalog {catalog['revision']}: {len(catalog['opportunities'])} valid entries; SHA256 {digest}")
