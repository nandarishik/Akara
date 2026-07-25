"""Export canonical SQLite databases to messy industry-specific CSV/XLSX files."""

from __future__ import annotations

from pathlib import Path

from generator.cafe.generate import run as export_cafe
from generator.garage.generate import run as export_garage
from generator.pharmacy.generate import run as export_pharmacy

ROOT = Path(__file__).resolve().parents[1]
CANONICAL = ROOT / "canonical"
DATASETS = ROOT / "datasets"


def export_all() -> dict[str, dict[str, int]]:
    """Regenerate messy exports from canonical DBs (creates canonical if missing)."""
    CANONICAL.mkdir(parents=True, exist_ok=True)
    return {
        "cafe_brewlab": export_cafe(
            CANONICAL / "cafe_brewlab.db",
            DATASETS / "cafe_brewlab",
        ),
        "garage_autocare": export_garage(
            CANONICAL / "garage_autocare.db",
            DATASETS / "garage_autocare",
        ),
        "pharmacy_medplus": export_pharmacy(
            CANONICAL / "pharmacy_medplus.db",
            DATASETS / "pharmacy_medplus",
        ),
    }


if __name__ == "__main__":
    counts = export_all()
    for biz, files in counts.items():
        print(f"{biz}: {files}")
