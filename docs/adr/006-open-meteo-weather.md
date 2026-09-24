# ADR 006 — Open-Meteo weather cache

Status: accepted

Cache Open-Meteo in Postgres `weather_cache` keyed `(city_slug, cache_date)`.
No Redis. Timeout 10s. On failure omit weather; never block the morning brief.
`raw_response` is JSONB and is never interpolated into SQL.
Attribution: Weather data from Open-Meteo (CC BY 4.0).
