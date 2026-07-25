"""Run copilot questions against benchmark tenants."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import httpx
import yaml

from harness.scorer import load_ground_truth, score_answer

ROOT = Path(__file__).resolve().parents[1]


def load_questions() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in sorted((ROOT / "questions").glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        for q in data["questions"]:
            q["business"] = data["business"]
            items.append(q)
    return items


async def ask_copilot(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    question: str,
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post(
        f"{base_url}/copilot/chat",
        headers=headers,
        json={"question": question, "stream": False},
        timeout=120.0,
    )
    if resp.status_code != 200:
        return {"success": False, "error": resp.text, "response": ""}
    data = resp.json()
    return {
        "success": True,
        "response": data.get("response", ""),
        "sql_used": data.get("sql_used"),
        "row_count": data.get("row_count"),
        "response_time_ms": data.get("response_time_ms"),
    }


async def run_copilot_phase(
    base_url: str,
    tokens: dict[str, str],
) -> list[dict[str, Any]]:
    gt = load_ground_truth()
    answers_by_id = {a["question_id"]: a for a in gt["answers"]}
    questions = load_questions()
    results: list[dict[str, Any]] = []

    async with httpx.AsyncClient() as client:
        for q in questions:
            biz = q["business"]
            token = tokens.get(biz) or tokens.get("default", "")
            if not token:
                results.append({"question_id": q["id"], "skipped": True, "reason": "no token"})
                continue
            copilot = await ask_copilot(client, base_url, token, q["question"])
            ground = answers_by_id.get(q["id"], {})
            scored = score_answer(ground, copilot.get("response", ""), q) if ground else {}
            results.append({**copilot, **scored, "question": q["question"]})

    return results


def run_sync(base_url: str, tokens: dict[str, str]) -> list[dict[str, Any]]:
    return asyncio.run(run_copilot_phase(base_url, tokens))
