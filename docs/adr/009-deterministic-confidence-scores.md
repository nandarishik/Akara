# ADR-009 — Deterministic confidence scores

Status: Accepted  
Phase: 11

`compute_confidence(data_days, CV, freshness)` is the only source of `confidence_score`. LLMs must not guess confidence. Uncertainty labels are appended for <30 / 30–90 / 90+ days.
