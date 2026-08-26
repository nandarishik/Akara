"""Jinja email template renderer."""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.api.superadmin.control_plane import resolve_published_content

_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

_DB_TEMPLATE_KEYS = {
    "welcome.html": "E1",
    "password_reset.html": "E2",
    "weekly_debrief.html": "E3",
    "morning_brief.html": "E4",
    "payment_failed.html": "E5",
    "payment_success.html": "E6",
    "dunning_reminder.html": "E7",
    "activation_day1.html": "E8",
    "activation_day3.html": "E9",
    "quota_warning.html": "E10",
    "team_invite.html": "E11",
}


def render_template(name: str, **context: object) -> str:
    key = _DB_TEMPLATE_KEYS.get(name)
    if key:
        payload, used_fallback = resolve_published_content("message_templates", key, {})
        if not used_fallback and isinstance(payload, dict):
            source = payload.get("html") or payload.get("body_html")
            if isinstance(source, str) and source.strip():
                return _env.from_string(source).render(**context)
    template = _env.get_template(name)
    return template.render(**context)
