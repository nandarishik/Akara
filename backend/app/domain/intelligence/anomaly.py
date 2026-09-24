"""PyOD IForest anomaly detection."""

from __future__ import annotations

from typing import Any

import numpy as np

MIN_TRAINING_DAYS = 30
CONTAMINATION = 0.1


def detect_iforest(values: list[float], *, contamination: float = CONTAMINATION) -> dict[str, Any] | None:
    if len(values) < MIN_TRAINING_DAYS:
        return None
    from pyod.models.iforest import IForest

    x = np.array(values, dtype=float).reshape(-1, 1)
    model = IForest(contamination=contamination, random_state=42)
    model.fit(x)
    last = x[-1:]
    raw = float(model.decision_function(last)[0])
    # Normalize roughly to [0, 1]
    score = float(max(0.0, min(1.0, (raw + 0.5))))
    is_outlier = bool(model.predict(last)[0] == 1)
    return {"score": score, "is_outlier": is_outlier, "series_days": len(values)}
