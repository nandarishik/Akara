"""Analyst Agent — deterministic, no LLM."""

from __future__ import annotations

from datetime import date
from typing import Any

import pandas as pd

from app.domain.intelligence.playbooks.delivery_margins import analyse_delivery_margins
from app.domain.intelligence.playbooks.festivals import generate_festival_signals
from app.domain.intelligence.playbooks.gst import generate_gst_optimisations
from app.domain.intelligence.playbooks.kasavana_smith import (
    compute_kasavana_smith_matrix,
)
from app.domain.intelligence.playbooks.leaks import detect_leaks
from app.domain.intelligence.playbooks.repricing import generate_repricing_candidates
from app.domain.intelligence.playbooks.weather import generate_weather_signals
from app.domain.intelligence.schemas import AnalystReport


def run_analyst(frames: dict[str, Any] | None = None, tenant_id: Any | None = None) -> AnalystReport:
    frames = frames or {}
    orders = frames.get("orders")
    if not isinstance(orders, pd.DataFrame):
        orders = pd.DataFrame()
    menu = frames.get("menu")
    if not isinstance(menu, pd.DataFrame):
        menu = pd.DataFrame()
    weather = frames.get("weather")
    festivals = frames.get("festivals") or []
    commissions = frames.get("commissions") or {}
    data_days = int(frames.get("data_days") or 0)
    return AnalystReport(
        kasavana_smith_matrix=compute_kasavana_smith_matrix(orders, menu),
        leak_detections=detect_leaks(orders, menu, orders),
        repricing_candidates=generate_repricing_candidates(menu, orders),
        gst_optimisations=generate_gst_optimisations(menu),
        delivery_margin_negatives=analyse_delivery_margins(orders, menu, commissions),
        weather_signals=generate_weather_signals(weather, orders),
        festival_signals=generate_festival_signals(festivals, frames.get("today") or date.today()),
        anomaly_context=list(frames.get("anomalies") or []),
        data_days=data_days,
    )
