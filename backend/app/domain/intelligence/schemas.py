"""Phase 11 domain DTOs and 14-field guard."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LLMRecommendationDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    assumptions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


@dataclass
class KasavanaSmithItem:
    item_id: str
    item_name: str
    category: str
    popularity_index: float
    contribution_margin: Decimal
    contribution_margin_index: float
    quadrant: str


@dataclass
class LeakResult:
    item_id: str
    item_name: str
    leak_type: str
    severity: str
    details: dict[str, Any]
    estimated_monthly_loss_inr: Decimal


@dataclass
class AnalystReport:
    kasavana_smith_matrix: list[KasavanaSmithItem] = field(default_factory=list)
    leak_detections: list[LeakResult] = field(default_factory=list)
    repricing_candidates: list[dict[str, Any]] = field(default_factory=list)
    gst_optimisations: list[dict[str, Any]] = field(default_factory=list)
    delivery_margin_negatives: list[dict[str, Any]] = field(default_factory=list)
    weather_signals: list[dict[str, Any]] = field(default_factory=list)
    festival_signals: list[dict[str, Any]] = field(default_factory=list)
    anomaly_context: list[dict[str, Any]] = field(default_factory=list)
    data_days: int = 0


REQUIRED_FOURTEEN = (
    "what_to_do",
    "why",
    "evidence",
    "confidence",
    "confidence_methodology",
    "impact_estimate",
    "assumptions",
    "cost_to_act",
    "risks",
    "time_horizon",
    "how_to_measure",
    "expires_at",
    "outcome_tracking_id",
    "model_version",
)

HOW_TO_MEASURE = (
    "14-day pre/post revenue comparison for affected items. No control group."
)


def require_fourteen_fields(dto: dict[str, Any]) -> dict[str, Any]:
    missing = [k for k in REQUIRED_FOURTEEN if dto.get(k) in (None, "", [])]
    if missing:
        raise ValueError(f"missing recommendation fields: {missing}")
    conf = dto.get("confidence")
    if conf is None:
        raise ValueError("confidence must be computed")
    return dto


def domain_from_row(
    *,
    rec_id: str,
    title: str,
    description: str,
    evidence: list[dict[str, Any]],
    confidence: float,
    confidence_methodology: str,
    impact_min: float | None,
    impact_max: float | None,
    assumptions: list[str],
    risks: list[str],
    cost_or_effort: str | None,
    expires_at: datetime,
    model_version: str,
) -> dict[str, Any]:
    mid = 0.0
    if impact_min is not None and impact_max is not None:
        mid = (float(impact_min) + float(impact_max)) / 2
    evidence_strs = [f"{e.get('label')}: {e.get('value')} {e.get('unit') or ''}".strip() for e in evidence]
    dto = {
        "what_to_do": title,
        "why": description,
        "evidence": evidence_strs,
        "confidence": confidence,
        "confidence_methodology": confidence_methodology,
        "impact_estimate": {
            "revenue_inr": mid,
            "horizon_days": 14,
            "min": impact_min,
            "max": impact_max,
            "currency": "INR",
        },
        "assumptions": assumptions or ["Time horizon: This month"],
        "cost_to_act": cost_or_effort or "Owner action required",
        "risks": risks or ["No control group"],
        "time_horizon": "This month",
        "how_to_measure": HOW_TO_MEASURE,
        "expires_at": expires_at,
        "outcome_tracking_id": rec_id,
        "model_version": model_version,
    }
    return require_fourteen_fields(dto)


@dataclass
class CandidateRecommendation:
    recommendation_type: str
    title: str
    description: str
    evidence: list[dict[str, Any]]
    confidence_score: float
    confidence_methodology: str
    data_days: int
    expected_impact_min: float
    expected_impact_max: float
    assumptions: list[str]
    risks: list[str]
    cost_or_effort: str
    primary_item_id: str | None
    model_version: str
    playbook_version: str
    uncertainty_label: str
    data_range_start: date
    data_range_end: date
    tenant_id: UUID | None = None
