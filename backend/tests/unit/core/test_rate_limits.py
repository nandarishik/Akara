"""Rate limit handler and limiter wiring tests."""

from app.core.rate_limit import rate_limit_exceeded_handler


async def test_rate_limit_handler_returns_json_envelope():
    class FakeRequest:
        class state:
            request_id = "req-test"

    class FakeLimit:
        error_message = None

    class FakeExc(Exception):
        def __init__(self):
            self.limit = FakeLimit()

    response = await rate_limit_exceeded_handler(FakeRequest(), FakeExc())
    assert response.status_code == 429
    body = response.body.decode()
    assert "RATE_LIMITED" in body
    assert "Too many requests" in body
