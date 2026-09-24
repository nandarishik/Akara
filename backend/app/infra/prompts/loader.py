"""Filesystem prompt loader (Phase 9 Partial)."""

from __future__ import annotations

from pathlib import Path

_ROOT = Path(__file__).resolve().parent


class PromptLoader:
    def load(self, name: str, version: int | None = None) -> str:
        if name == "semantic_layer":
            path = _ROOT / "semantic_layer.md"
            return path.read_text(encoding="utf-8") if path.is_file() else ""
        if version is None:
            matches = sorted(_ROOT.glob(f"{name}/*.md"))
            return matches[-1].read_text(encoding="utf-8") if matches else ""
        path = _ROOT / name / f"v{version}.md"
        return path.read_text(encoding="utf-8") if path.is_file() else ""
