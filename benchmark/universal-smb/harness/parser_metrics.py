"""Parser-focused metrics for industry-agnostic import testing."""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT.parents[1] / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(ROOT))

REQUIRED_CANONICAL = {"invoice_date", "party_name", "total_amount"}
OPTIONAL_CANONICAL = {
    "invoice_number",
    "product_name",
    "product_category",
    "quantity",
    "gross_amount",
    "discount_amount",
    "net_amount",
    "tax_amount",
}


@dataclass
class ParseMetrics:
    file: str
    success: bool
    rows_parsed: int = 0
    rows_expected_min: int = 0
    columns_mapped: list[str] = field(default_factory=list)
    columns_missing: list[str] = field(default_factory=list)
    optional_recovered: list[str] = field(default_factory=list)
    error: str | None = None
    sheet: str | None = None

    @property
    def required_recovery_rate(self) -> float:
        if not self.success:
            return 0.0
        have = len(REQUIRED_CANONICAL - set(self.columns_missing))
        return have / len(REQUIRED_CANONICAL)

    @property
    def optional_recovery_rate(self) -> float:
        if not self.success:
            return 0.0
        return len(self.optional_recovered) / len(OPTIONAL_CANONICAL)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file": self.file,
            "success": self.success,
            "rows_parsed": self.rows_parsed,
            "rows_expected_min": self.rows_expected_min,
            "required_recovery_rate": round(self.required_recovery_rate, 4),
            "optional_recovery_rate": round(self.optional_recovery_rate, 4),
            "columns_mapped": self.columns_mapped,
            "columns_missing": self.columns_missing,
            "optional_recovered": self.optional_recovered,
            "error": self.error,
            "sheet": self.sheet,
        }


def evaluate_parse(
    path: Path,
    *,
    sheet_name: str | None = None,
    expected_rows_min: int = 0,
) -> ParseMetrics:
    from app.services.data_import.parser import SalesDataParser

    metrics = ParseMetrics(
        file=str(path.name),
        success=False,
        rows_expected_min=expected_rows_min,
        sheet=sheet_name,
    )
    if not path.exists():
        metrics.error = "file missing"
        return metrics

    parser = SalesDataParser(sheet_name=sheet_name)
    try:
        df = parser.parse(path.read_bytes(), path.name)
    except Exception as exc:
        metrics.error = str(exc)
        return metrics

    metrics.success = True
    metrics.rows_parsed = len(df)
    metrics.columns_mapped = list(df.columns)

    for col in REQUIRED_CANONICAL:
        if col not in df.columns:
            metrics.columns_missing.append(col)

    for col in OPTIONAL_CANONICAL:
        if col in df.columns:
            metrics.optional_recovered.append(col)

    if metrics.rows_expected_min and metrics.rows_parsed < metrics.rows_expected_min:
        metrics.success = False
        metrics.error = (
            f"row count {metrics.rows_parsed} below minimum {metrics.rows_expected_min}"
        )

    if metrics.columns_missing:
        metrics.success = False
        metrics.error = f"missing required: {metrics.columns_missing}"

    return metrics


def evaluate_manifest_import_files(manifest_path: Path | None = None) -> list[ParseMetrics]:
    manifest_path = manifest_path or ROOT / "manifest.yaml"
    manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    results: list[ParseMetrics] = []

    for biz in manifest["businesses"].values():
        dataset_dir = ROOT / biz["dataset_dir"]
        for spec in biz["files"]:
            if not spec.get("import"):
                continue
            path = dataset_dir / spec["path"]
            results.append(
                evaluate_parse(
                    path,
                    sheet_name=spec.get("recommended_sheet"),
                    expected_rows_min=spec.get("expected_rows_min", 0),
                )
            )

    return results


def summarize_parser_results(metrics: list[ParseMetrics]) -> dict[str, Any]:
    if not metrics:
        return {"parse_success_rate": 0.0, "avg_required_recovery": 0.0}
    ok = sum(1 for m in metrics if m.success)
    return {
        "parse_success_rate": round(ok / len(metrics), 4),
        "avg_required_recovery": round(
            sum(m.required_recovery_rate for m in metrics) / len(metrics), 4
        ),
        "avg_optional_recovery": round(
            sum(m.optional_recovery_rate for m in metrics) / len(metrics), 4
        ),
        "total_rows_parsed": sum(m.rows_parsed for m in metrics),
        "files": [m.to_dict() for m in metrics],
    }
