"""Superadmin recommendation coverage / quality / weights."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.superadmin import SuperAdmin
from app.domain.intelligence import recommendation_repo as repo

router = APIRouter(prefix="/recommendations", tags=["superadmin"])


class WeightOverride(BaseModel):
    weight: float


@router.get("/coverage")
def coverage(_admin: SuperAdmin) -> dict:
    tenants = {r["tenant_id"] for r in repo.snapshot()}
    with_rec = {r["tenant_id"] for r in repo.snapshot() if r.get("id")}
    total = max(len(tenants), 1)
    return {"tenants_with_recommendations": len(with_rec), "tenant_count": total, "coverage_pct": round(100 * len(with_rec) / total, 1)}


@router.get("/quality")
def quality(_admin: SuperAdmin) -> dict:
    rows = repo.snapshot()
    accepted = [r for r in rows if r["status"] in {"watching", "resolved"}]
    rejected = [r for r in rows if r["status"] == "rejected"]
    conf = [float(r.get("confidence_score") or 0) for r in rows]
    return {
        "acceptance_rate": (len(accepted) / len(rows)) if rows else 0,
        "reject_rate": (len(rejected) / len(rows)) if rows else 0,
        "avg_confidence": (sum(conf) / len(conf)) if conf else 0,
    }


@router.get("/playbook-weights")
def list_weights(_admin: SuperAdmin) -> dict:
    return {
        "items": [
            {"tenant_id": None, "playbook_name": name, "weight": 1.0}
            for name in (
                "menu_engineering",
                "repricing",
                "waste_detection",
                "gst_optimisation",
                "delivery_margin",
                "weather_playbook",
                "festival_playbook",
            )
        ]
    }


weights_router = APIRouter(prefix="/playbook-weights", tags=["superadmin"])


@weights_router.get("")
def get_weights(_admin: SuperAdmin) -> dict:
    return list_weights(_admin)


@weights_router.post("/{name}")
def override_weight(name: str, body: WeightOverride, _admin: SuperAdmin) -> dict:
    return {"playbook_name": name, "weight": body.weight}
