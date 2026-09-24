# ADR 005 — PyOD Isolation Forest

Status: accepted

Anomaly layer uses `pyod.models.iforest.IForest(contamination=0.1, random_state=42)`
on 60-day daily series. Skip when fewer than 30 days.
Feedback / “this was wrong” is Phase 11.
