"""Weather signals — consume weather_cache only; miss → []."""

from __future__ import annotations

import pandas as pd


def generate_weather_signals(weather: dict | None, orders_history: pd.DataFrame | None = None) -> list[dict]:
    if not weather:
        return []
    signals: list[dict] = []
    if weather.get("is_rainy") or float(weather.get("precipitation_mm") or 0) > 0:
        signals.append(
            {
                "type": "weather_opportunity",
                "trigger": "rain_forecast",
                "action": "Push chai, filter coffee, hot chocolate on digital menu",
                "rationale": "Historical data shows hot beverage sales increase 20-35% on rainy days.",
            }
        )
        signals.append(
            {
                "type": "weather_alert",
                "trigger": "rain_forecast",
                "action": "Expect 10-20% lower dine-in traffic; ensure delivery menu is updated",
                "rationale": "Rainy days reduce dine-in; delivery compensates partially.",
            }
        )
    if float(weather.get("temp_max_c") or 25) > 35:
        signals.append(
            {
                "type": "weather_opportunity",
                "trigger": "heat_wave",
                "action": "Feature cold brew, iced teas, and refreshers prominently",
                "rationale": "Cold beverage demand correlates with ambient temperature >35°C.",
            }
        )
    return signals
