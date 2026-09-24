from app.domain.intelligence.playbooks.weather import generate_weather_signals


def test_rain_and_heat_and_mild() -> None:
    rain = generate_weather_signals({"is_rainy": True, "temp_max_c": 28})
    assert any(s["trigger"] == "rain_forecast" for s in rain)
    heat = generate_weather_signals({"is_rainy": False, "temp_max_c": 36})
    assert any(s["trigger"] == "heat_wave" for s in heat)
    assert generate_weather_signals({"is_rainy": False, "temp_max_c": 29}) == []
    assert generate_weather_signals(None) == []
