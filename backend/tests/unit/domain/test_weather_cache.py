from datetime import date

from app.domain.intelligence.weather_service import (
    enrich_with_weather,
    parse_open_meteo,
)


def test_parse_open_meteo_rain() -> None:
    parsed = parse_open_meteo(
        {"daily": {"temperature_2m_max": [29], "precipitation_sum": [20], "weathercode": [61]}}
    )
    assert parsed["is_rainy"] is True
    assert parsed["precipitation_mm"] == 20


def test_cache_hit_skips_fetch() -> None:
    called = {"n": 0}

    def cache_get(slug: str, d: date):
        return {"temp_max_c": 30, "precipitation_mm": 0, "is_rainy": False}

    def cache_put(*_a):
        raise AssertionError("should not write")

    def fetcher(*_a):
        called["n"] += 1
        return {}

    row = enrich_with_weather(
        city_slug="mumbai",
        cache_date=date(2026, 9, 9),
        latitude=19.0,
        longitude=72.8,
        cache_get=cache_get,
        cache_put=cache_put,
        fetcher=fetcher,
    )
    assert row and row["temp_max_c"] == 30
    assert called["n"] == 0


def test_open_meteo_500_omits_weather() -> None:
    def cache_get(*_a):
        return None

    def cache_put(*_a):
        return None

    def fetcher(*_a):
        raise RuntimeError("500")

    assert (
        enrich_with_weather(
            city_slug="mumbai",
            cache_date=date(2026, 9, 9),
            latitude=19.0,
            longitude=72.8,
            cache_get=cache_get,
            cache_put=cache_put,
            fetcher=fetcher,
        )
        is None
    )
