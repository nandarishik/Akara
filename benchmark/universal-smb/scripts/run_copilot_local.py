"""Run copilot benchmark questions in-process (import + LLM, no HTTP JWT).

Usage:
  cd akara/backend
  set PYTHONPATH=../benchmark/universal-smb
  uv run python ../benchmark/universal-smb/scripts/run_copilot_local.py --business cafe_brewlab --limit 3
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import date
from pathlib import Path

BENCHMARK = Path(__file__).resolve().parents[1]
BACKEND = BENCHMARK.parents[1] / "backend"
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BENCHMARK))

import yaml

from harness.scorer import load_ground_truth, score_answer


def _safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


async def _run(args: argparse.Namespace) -> None:
    from app.core.config import settings  # noqa: F401 — loads .env
    from app.core.tenant import get_supabase_service_client
    from app.services.copilot.agent import CopilotAgent
    from app.services.copilot.planner import Planner
    from app.services.copilot.synthesizer import Synthesizer
    from app.services.copilot.tools.context_tool import ContextTool
    from app.services.copilot.tools.sql_tool import SQLTool
    from app.services.data_import.service import DataImportService
    from app.services.llm.manager import LLMManager
    from app.services.prompts.generator import PromptGenerator
    from app.services.schema.discovery import SchemaDiscovery
    from app.sql.executor import SQLExecutor

    supabase = get_supabase_service_client()

    tenant_id = args.tenant_id
    if not tenant_id:
        row = (
            supabase.table("profiles")
            .select("tenant_id, role")
            .eq("role", "admin")
            .limit(1)
            .execute()
        )
        if not row.data:
            raise SystemExit("No admin profile in Supabase. Pass --tenant-id UUID.")
        tenant_id = row.data[0]["tenant_id"]
        print(f"Using tenant {tenant_id}")

    tid = uuid.UUID(str(tenant_id))

    if args.import_data:
        manifest = yaml.safe_load((BENCHMARK / "manifest.yaml").read_text(encoding="utf-8"))
        biz_cfg = manifest["businesses"][args.business]
        dataset_dir = BENCHMARK / biz_cfg["dataset_dir"]
        svc = DataImportService(supabase)
        for spec in biz_cfg["files"]:
            if not spec.get("import"):
                continue
            path = dataset_dir / spec["path"]
            print(f"Importing {path.name}...")
            content = path.read_bytes()
            sheet = spec.get("recommended_sheet")
            st = spec.get("source_type", "primary")
            df = svc.parse_dataframe(content, path.name, source_type=st, sheet_name=sheet)
            result = svc.import_dataframe(df, tid, st, path.name, sheet_name=sheet)
            print(f"  -> {result.rows_inserted} rows inserted")

    gt = load_ground_truth()
    answers_by_id = {a["question_id"]: a for a in gt["answers"]}
    questions: list[dict] = []
    for path in sorted((BENCHMARK / "questions").glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if data["business"] != args.business:
            continue
        questions.extend(data["questions"])
    questions = questions[: args.limit]

    schema = SchemaDiscovery(supabase=supabase)
    prompt_gen = PromptGenerator(schema_discovery=schema)
    schema_ctx = prompt_gen.build_schema_context(tid)
    columns = schema.get_columns()
    dr = schema.get_data_date_range(tid)
    date_range = dr if dr else ("2024-01-01", date.today().isoformat())

    llm = LLMManager(openrouter_api_key=settings.openrouter_api_key)
    executor = SQLExecutor(client=supabase)
    agent = CopilotAgent(
        planner=Planner(llm=llm),
        synthesizer=Synthesizer(llm=llm),
        sql_tool=SQLTool(executor=executor, tenant_id=tid),
        context_tool=ContextTool(supabase=supabase, tenant_id=tid),
        tenant_id=tid,
    )

    print(f"\nRunning {len(questions)} copilot questions for {args.business}...\n")
    for q in questions:
        result = await agent.answer(q["question"], schema_ctx, columns, date_range)
        ground = answers_by_id.get(q["id"], {})
        scored = score_answer(ground, result.response, q) if ground else {}
        status = "PASS" if scored.get("passed") else "FAIL"
        _safe_print(f"[{status}] {q['id']}: {q['question']}")
        _safe_print(f"  Expected: {ground.get('answer')} {ground.get('unit', '')}")
        _safe_print(f"  Copilot:  {result.response[:400]}{'...' if len(result.response) > 400 else ''}")
        if result.sql_queries_run:
            _safe_print(f"  SQL: {result.sql_queries_run[0][:200]}...")
        _safe_print("")


def main() -> None:
    parser = argparse.ArgumentParser(description="Local copilot benchmark runner")
    parser.add_argument("--business", default="cafe_brewlab")
    parser.add_argument("--tenant-id", default=None)
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--no-import", action="store_true")
    args = parser.parse_args()
    args.import_data = not args.no_import
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
