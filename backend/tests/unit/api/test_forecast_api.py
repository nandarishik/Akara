from app.api.v1.forecasts import router


def test_forecast_routes_exist() -> None:
    paths = {getattr(r, "path", "") for r in router.routes}
    assert "" in paths or any("forecasts" in str(r) for r in router.routes)
    assert any("/summary" in getattr(r, "path", "") for r in router.routes)
