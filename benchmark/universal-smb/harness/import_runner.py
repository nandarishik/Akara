"""Parser-only metrics without API."""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path
from typing import Any

import httpx
import yaml

ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = ROOT.parents[1] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))
sys.path.insert(0, str(ROOT))

from harness.parser_metrics import evaluate_manifest_import_files, summarize_parser_results


def load_manifest() -> dict[str, Any]:
    return yaml.safe_load((ROOT / "manifest.yaml").read_text(encoding="utf-8"))


def parse_file_local(path: Path, sheet: str | None = None) -> dict[str, Any]:
    from harness.parser_metrics import evaluate_parse

    return evaluate_parse(path, sheet_name=sheet).to_dict()


async def import_file(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    file_path: Path,
    *,
    source_type: str = "primary",
    sheet_name: str | None = None,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    content = file_path.read_bytes()
    filename = file_path.name

    selected_sheet = sheet_name
    if file_path.suffix.lower() in (".xlsx", ".xls") and sheet_name:
        sheets_resp = await client.post(
            f"{base_url}/data/sheets",
            headers=headers,
            files={"file": (filename, content, "application/octet-stream")},
        )
        if sheets_resp.status_code == 200:
            selected_sheet = sheet_name

    files = {"file": (filename, content, "application/octet-stream")}
    data = {"source_type": source_type}
    if selected_sheet:
        data["sheet_name"] = selected_sheet

    resp = await client.post(
        f"{base_url}/data/import",
        headers=headers,
        files=files,
        data=data,
        timeout=300.0,
    )
    if resp.status_code != 200:
        return {"success": False, "error": resp.text, "rows_imported": 0}
    body = resp.json()
    return {
        "success": True,
        "rows_imported": body.get("rows_imported", body.get("imported_rows", 0)),
        "warnings": body.get("warnings", []),
        "import_id": body.get("import_id"),
    }


def reset_tenant_data(tenant_id: str) -> dict[str, Any]:
    """Delete sales_data for tenant via Supabase service role (optional)."""
    url = os.environ.get("BENCHMARK_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
    key = os.environ.get("BENCHMARK_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return {"skipped": True, "reason": "No Supabase credentials"}
    try:
        from supabase import create_client

        client = create_client(url, key)
        client.table("sales_data").delete().eq("tenant_id", tenant_id).execute()
        return {"skipped": False, "reset": True}
    except Exception as exc:
        return {"skipped": False, "reset": False, "error": str(exc)}


async def run_imports(
    base_url: str,
    token: str,
    *,
    parser_only: bool = False,
) -> dict[str, Any]:
    manifest = load_manifest()
    results: dict[str, Any] = {"businesses": {}, "parser_only": parser_only}

    async with httpx.AsyncClient() as client:
        for biz_key, biz in manifest["businesses"].items():
            biz_results: list[dict[str, Any]] = []
            dataset_dir = ROOT / biz["dataset_dir"]
            for spec in biz["files"]:
                if not spec.get("import"):
                    continue
                path = dataset_dir / spec["path"]
                if not path.exists():
                    biz_results.append({"file": spec["path"], "success": False, "error": "missing"})
                    continue
                if parser_only:
                    r = parse_file_local(path, spec.get("recommended_sheet"))
                else:
                    r = await import_file(
                        client,
                        base_url,
                        token,
                        path,
                        source_type=spec.get("source_type", "primary"),
                        sheet_name=spec.get("recommended_sheet"),
                    )
                r["file"] = spec["path"]
                biz_results.append(r)
            results["businesses"][biz_key] = biz_results

    return results
