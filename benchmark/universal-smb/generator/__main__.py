"""Generate all benchmark datasets and ground truth."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from generator.cafe.generate import run as run_cafe
from generator.garage.generate import run as run_garage
from generator.pharmacy.generate import run as run_pharmacy


def main() -> None:
    canonical_dir = ROOT / "canonical"
    datasets_dir = ROOT / "datasets"
    canonical_dir.mkdir(parents=True, exist_ok=True)

    print("Generating café dataset...")
    cafe_counts = run_cafe(
        canonical_dir / "cafe_brewlab.db",
        datasets_dir / "cafe_brewlab",
    )
    print(f"  Cafe: {cafe_counts}")

    print("Generating garage dataset...")
    garage_counts = run_garage(
        canonical_dir / "garage_autocare.db",
        datasets_dir / "garage_autocare",
    )
    print(f"  Garage: {garage_counts}")

    print("Generating pharmacy dataset...")
    pharmacy_counts = run_pharmacy(
        canonical_dir / "pharmacy_medplus.db",
        datasets_dir / "pharmacy_medplus",
    )
    print(f"  Pharmacy: {pharmacy_counts}")

    print("Computing ground truth...")
    from ground_truth.compute import main as compute_gt

    compute_gt()
    print("Done.")


if __name__ == "__main__":
    main()
