"""CLI entry points for running SMB benchmark from backend dev env."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BENCHMARK = Path(__file__).resolve().parents[2] / "benchmark" / "universal-smb"


def parser_only() -> None:
    """Run parser-only benchmark (no API / LLM)."""
    if not BENCHMARK.is_dir():
        raise SystemExit(f"Benchmark package not found: {BENCHMARK}")
    backend = BENCHMARK.parents[1] / "backend"
    env = {**dict(**__import__("os").environ), "PYTHONPATH": f"{backend}{__import__('os').pathsep}{BENCHMARK}"}
    cmd = [sys.executable, "-m", "harness.run_benchmark", "--parser-only"]
    raise SystemExit(subprocess.call(cmd, cwd=BENCHMARK, env=env))
