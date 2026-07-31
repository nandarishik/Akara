"""Day 10 CMS publish validation."""

from __future__ import annotations

from app.services.content.cms_service import validate_content


def test_validate_content_blocks_unsafe_html():
    warnings = validate_content({"html": "<script>alert(1)</script>"})
    assert any("Unsafe" in w for w in warnings)


def test_validate_content_clean():
    warnings = validate_content({"text": "Hello AKARA"})
    assert warnings == [] or not any("Unsafe" in w for w in warnings)
