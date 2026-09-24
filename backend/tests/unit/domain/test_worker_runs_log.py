from app.domain.intelligence.worker_runs import run_with_retry


def test_three_retries_then_dead_letter() -> None:
    def boom() -> None:
        raise RuntimeError("db fail")

    run = run_with_retry(boom, sleep=lambda _s: None)
    assert run["status"] == "dead_letter"
    assert run["retry_attempt"] == 3
