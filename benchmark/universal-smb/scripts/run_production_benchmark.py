"""Import benchmark data per tenant, run all copilot questions, emit JSON report."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

BENCHMARK = Path(__file__).resolve().parents[1]
BACKEND = BENCHMARK.parents[1] / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BENCHMARK))

import yaml

from harness.scorer import load_ground_truth, score_answer

TENANT_ASSIGNMENTS: list[dict[str, str]] = [
    {
        "business": "cafe_brewlab",
        "tenant_id": "20680f1e-e5b4-44c7-9238-dff311d6999b",
        "email": "fadenthreads@gmail.com",
        "tenant_name": "Bandi traders",
    },
    {
        "business": "pharmacy_medplus",
        "tenant_id": "1287ace7-1a7f-4745-bdde-78e9a33f86b4",
        "email": "meghanajhadi28@gmail.com",
        "tenant_name": "Faden",
    },
    {
        "business": "garage_autocare",
        "tenant_id": "8a6141c2-8013-4b7e-a79c-353d1348e028",
        "email": "nandarishik.bandi13@gmail.com",
        "tenant_name": "AKARA Demo",
    },
]


def _reset_tenant_data(supabase, tenant_id: str) -> None:
    supabase.table("sales_data").delete().eq("tenant_id", tenant_id).execute()
    try:
        supabase.table("tenant_companion_data").delete().eq("tenant_id", tenant_id).execute()
    except Exception:
        pass


def _fetch_tenant_config(supabase, tenant_id: str) -> dict:
    row = supabase.table("tenants").select("config").eq("id", tenant_id).single().execute()
    return row.data.get("config") or {}


def _import_business(
    supabase,
    tenant_id: uuid.UUID,
    business: str,
    *,
    xlsx_only: bool = False,
    import_companion: bool = True,
) -> list[dict[str, Any]]:
    from app.services.data_import.companion_service import CompanionImportService
    from app.services.data_import.service import DataImportService

    manifest = yaml.safe_load((BENCHMARK / "manifest.yaml").read_text(encoding="utf-8"))
    biz_cfg = manifest["businesses"][business]
    dataset_dir = BENCHMARK / biz_cfg["dataset_dir"]
    svc = DataImportService(supabase)
    companion_svc = CompanionImportService(supabase)
    imports: list[dict[str, Any]] = []

    for spec in biz_cfg["files"]:
        if spec.get("import"):
            if xlsx_only and spec.get("skip_when_xlsx_only"):
                continue
            path = dataset_dir / spec["path"]
            if not path.exists():
                imports.append({"file": spec["path"], "error": "file missing", "rows_inserted": 0})
                continue
            content = path.read_bytes()
            sheet = spec.get("recommended_sheet")
            st = spec.get("source_type", "primary")
            df = svc.parse_dataframe(content, path.name, source_type=st, sheet_name=sheet)
            result = svc.import_dataframe(df, tenant_id, st, path.name, sheet_name=sheet)
            imports.append(
                {
                    "file": spec["path"],
                    "kind": "primary",
                    "rows_inserted": result.rows_inserted,
                    "rows_skipped": result.rows_skipped,
                }
            )
        elif import_companion and spec.get("companion_import"):
            path = dataset_dir / spec["path"]
            if not path.exists():
                continue
            try:
                out = companion_svc.import_file(
                    path.read_bytes(),
                    path.name,
                    tenant_id,
                    spec["dataset_type"],
                    clear_existing=False,
                )
                imports.append({"file": spec["path"], "kind": "companion", **out})
            except Exception as exc:
                imports.append({"file": spec["path"], "kind": "companion", "error": str(exc)})

    return imports


async def _run_questions(
    supabase,
    tenant_id: uuid.UUID,
    business: str,
    tenant_config: dict,
) -> list[dict[str, Any]]:
    from app.core.config import settings  # noqa: F401
    from app.services.copilot.agent import CopilotAgent
    from app.services.copilot.planner import Planner
    from app.services.copilot.synthesizer import Synthesizer
    from app.services.copilot.tools.context_tool import ContextTool
    from app.services.copilot.tools.sql_tool import SQLTool
    from app.services.llm.manager import LLMManager
    from app.services.prompts.generator import PromptGenerator
    from app.services.schema.discovery import SchemaDiscovery
    from app.sql.executor import SQLExecutor

    gt = load_ground_truth()
    answers_by_id = {a["question_id"]: a for a in gt["answers"]}
    questions: list[dict] = []
    for path in sorted((BENCHMARK / "questions").glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if data["business"] != business:
            continue
        questions.extend(data["questions"])

    schema = SchemaDiscovery(supabase=supabase)
    prompt_gen = PromptGenerator(schema_discovery=schema)
    schema_ctx = prompt_gen.build_schema_context(tenant_id)
    columns = schema.get_columns()
    allowed_vocabulary = schema.get_allowed_vocabulary(tenant_id)
    dr = schema.get_data_date_range(tenant_id)
    date_range = dr if dr else ("2024-01-01", date.today().isoformat())

    planner_addendum = prompt_gen.build_planner_addendum(tenant_config, business=business)
    synthesizer_addendum = prompt_gen.build_synthesizer_addendum(tenant_config, business=business)

    llm = LLMManager(openrouter_api_key=settings.openrouter_api_key)
    executor = SQLExecutor(client=supabase)
    agent = CopilotAgent(
        planner=Planner(llm=llm),
        synthesizer=Synthesizer(llm=llm),
        sql_tool=SQLTool(executor=executor, tenant_id=tenant_id),
        context_tool=ContextTool(supabase=supabase, tenant_id=tenant_id),
        tenant_id=tenant_id,
    )

    results: list[dict[str, Any]] = []
    for q in questions:
        agent_result = await agent.answer(
            q["question"],
            schema_ctx,
            columns,
            date_range,
            planner_addendum=planner_addendum,
            synthesizer_addendum=synthesizer_addendum,
            allowed_vocabulary=allowed_vocabulary,
        )
        ground = answers_by_id.get(q["id"], {})
        scored = score_answer(ground, agent_result.response, q) if ground else {}
        results.append(
            {
                "question_id": q["id"],
                "question": q["question"],
                "difficulty": q.get("difficulty"),
                "answer_type": q.get("answer_type"),
                "expected": ground.get("answer"),
                "expected_unit": ground.get("unit", ""),
                "passed": scored.get("passed", False),
                "score": scored.get("score", 0),
                "parsed": scored.get("parsed"),
                "response": agent_result.response,
                "sql_queries": agent_result.sql_queries_run,
                "guardrails": agent_result.guardrail_results,
                "cross_file": q.get("difficulty", 0) >= 7,
            }
        )
    return results


def _tier_summary(questions: list[dict[str, Any]]) -> dict[str, Any]:
    single = [q for q in questions if q.get("difficulty", 0) <= 6]
    cross = [q for q in questions if q.get("difficulty", 0) >= 7]
    sp = sum(1 for q in single if q["passed"])
    cp = sum(1 for q in cross if q["passed"])
    return {
        "single_table_passed": sp,
        "single_table_total": len(single),
        "cross_file_passed": cp,
        "cross_file_total": len(cross),
        "single_table_pass_rate": round(sp / len(single), 3) if single else 0,
        "cross_file_pass_rate": round(cp / len(cross), 3) if cross else 0,
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx-only", action="store_true", help="Cafe: skip online_orders CSV")
    parser.add_argument("--no-companion", action="store_true", help="Skip companion CSV imports")
    args = parser.parse_args()

    from app.core.config import settings  # noqa: F401
    from app.core.tenant import get_supabase_service_client

    supabase = get_supabase_service_client()
    report: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "options": {"xlsx_only": args.xlsx_only, "import_companion": not args.no_companion},
        "tenants": [],
        "summary": {},
    }

    all_questions: list[dict] = []
    for assignment in TENANT_ASSIGNMENTS:
        tid_str = assignment["tenant_id"]
        business = assignment["business"]
        tid = uuid.UUID(tid_str)
        print(f"\n=== {assignment['email']} / {business} ===")
        _reset_tenant_data(supabase, tid_str)
        tenant_config = _fetch_tenant_config(supabase, tid_str)
        imports = _import_business(
            supabase,
            tid,
            business,
            xlsx_only=args.xlsx_only,
            import_companion=not args.no_companion,
        )
        for imp in imports:
            print(f"  {imp.get('kind', 'import')} {imp.get('file')}: {imp.get('rows_inserted', imp.get('error'))}")
        q_results = await _run_questions(supabase, tid, business, tenant_config)
        passed = sum(1 for r in q_results if r["passed"])
        tier = _tier_summary(q_results)
        print(f"  Score: {passed}/{len(q_results)} | single-table {tier['single_table_passed']}/{tier['single_table_total']}")
        all_questions.extend(q_results)
        report["tenants"].append({**assignment, "imports": imports, "questions": q_results, "passed": passed, "total": len(q_results), "tiers": tier})

    total_pass = sum(1 for q in all_questions if q["passed"])
    report["summary"] = {
        "total_passed": total_pass,
        "total_questions": len(all_questions),
        "pass_rate": round(total_pass / len(all_questions), 3) if all_questions else 0,
        **_tier_summary(all_questions),
    }

    out_dir = BENCHMARK / "results"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"production_benchmark_{stamp}.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    latest = out_dir / "production_benchmark_latest.json"
    latest.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nReport: {out_path}")
    print(f"Overall: {total_pass}/{len(all_questions)} ({report['summary']['pass_rate']*100:.1f}%)")


if __name__ == "__main__":
    asyncio.run(main())
