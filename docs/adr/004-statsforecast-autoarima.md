# ADR 004 — StatsForecast AutoARIMA

Status: accepted

7-day demand forecasts use `statsforecast.StatsForecast` + `AutoARIMA(season_length=7)`.
Skip series with fewer than 14 consecutive days. Production `n_jobs=1`.
TimesFM / Prophet / causal libraries are out of scope.
