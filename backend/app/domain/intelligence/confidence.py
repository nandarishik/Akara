from __future__ import annotations

def compute_confidence(signal_strength: float, data_days: int) -> float:
    if data_days < 7:
        return min(0.4, signal_strength)
    return min(0.99, max(0.1, signal_strength))
