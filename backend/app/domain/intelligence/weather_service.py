"""Open-Meteo cache-first weather (AD-P10-001). JSONB raw_response is never interpolated into SQL."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import date
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RAIN_MM = 5.0
ATTRIBUTION = "Weather data from Open-Meteo (CC BY 4.0)"


def parse_open_meteo(payload: dict[str, Any]) -> dict[str, Any]:
    daily = payload.get("daily") or {}
    temps = daily.get("temperature_2m_max") or [None]
    rains = daily.get("precipitation_sum") or [None]
    codes = daily.get("weathercode") or daily.get("weather_code") or [None]
    precip = float(rains[0] or 0)
    return {
        "temp_max_c": float(temps[0] or 0),
        "precipitation_mm": precip,
        "weather_code": int(codes[0] or 0),
        "is_rainy": precip > RAIN_MM,
        "attribution": ATTRIBUTION,
        "raw_response": payload,
    }


def fetch_open_meteo(lat: float, lon: float, timeout: float = 10.0) -> dict[str, Any]:
    base = getattr(settings, "open_meteo_base_url", "https://api.open-meteo.com/v1")
    url = f"{base.rstrip('/')}/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,precipitation_sum,weathercode",
        "timezone": "Asia/Kolkata",
        "forecast_days": 1,
    }
    with httpx.Client(timeout=timeout) as client:
        res = client.get(url, params=params)
        res.raise_for_status()
        return parse_open_meteo(res.json())


def enrich_with_weather(
    *,
    city_slug: str,
    cache_date: date,
    latitude: float,
    longitude: float,
    cache_get: Callable[[str, date], dict[str, Any] | None],
    cache_put: Callable[[str, date, dict[str, Any]], None],
    fetcher: Callable[[float, float], dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    hit = cache_get(city_slug, cache_date)
    if hit:
        return hit
    fn = fetcher or (lambda la, lo: fetch_open_meteo(la, lo))
    try:
        parsed = fn(latitude, longitude)
    except Exception:
        logger.warning("open_meteo_failed city=%s", city_slug)
        return None
    row = {
        "city_slug": city_slug,
        "cache_date": cache_date.isoformat(),
        "temp_max_c": parsed["temp_max_c"],
        "precipitation_mm": parsed["precipitation_mm"],
        "weather_code": parsed["weather_code"],
        "is_rainy": parsed["is_rainy"],
        "attribution": ATTRIBUTION,
        "raw_response": parsed.get("raw_response") or {},
    }
    cache_put(city_slug, cache_date, row)
    return row
