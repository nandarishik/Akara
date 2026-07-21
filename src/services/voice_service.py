"""
QAFFEINE Voice Service — Speech-to-Text via OpenRouter
=======================================================
Transcribes audio bytes using OpenRouter's /audio/transcriptions endpoint,
which proxies OpenAI Whisper-large-v3.  Reuses the existing OPENROUTER_API_KEY
so no new accounts or dependencies are needed.

OpenRouter expects a JSON body with base64-encoded audio:
  { "model": "openai/whisper-large-v3",
    "input_audio": { "data": "<base64>", "format": "wav" } }

Usage (from dashboard):
    from src.services.voice_service import transcribe_audio
    text = transcribe_audio(audio_bytes)
"""

from __future__ import annotations

import base64
import json
import logging
import os
from typing import Optional

import requests

from src.config.env import load_app_dotenv

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
_OPENROUTER_TRANSCRIPTION_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
_DEFAULT_MODEL = "openai/whisper-large-v3"
_TIMEOUT_SECONDS = 30


def _get_openrouter_key() -> str:
    """Resolve the OpenRouter API key from Streamlit secrets or env."""
    # 1. Try Streamlit secrets (deployed)
    try:
        import streamlit as st
        val = st.secrets.get("openrouter", {}).get("api_key") or st.secrets.get("OPENROUTER_API_KEY")
        if val:
            return str(val).strip()
    except Exception:
        pass
    # 2. Local .env fallback
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def _detect_audio_format(audio_bytes: bytes, filename: str, mime_type: Optional[str] = None) -> str:
    """Detect the audio format by sniffing mime_type, magic bytes in the header, or filename."""
    if mime_type:
        parts = mime_type.lower().split("/")
        if len(parts) == 2 and parts[0] == "audio":
            # Extract subtype, handling parameters like ;codecs=opus
            subtype = parts[1].split(";")[0].strip()
            if subtype in ("wav", "mp3", "webm", "ogg", "flac", "m4a", "mp4"):
                return subtype
            # Map common variations
            if subtype in ("mpeg", "mpeg3", "x-mpeg-3"):
                return "mp3"
            if subtype in ("x-wav", "wave"):
                return "wav"
            if subtype in ("x-webm",):
                return "webm"

    if audio_bytes[:4] == b'\x1aE\xdf\xa3':
        return "webm"          # WebM / Matroska (Chrome, Edge, Firefox)
    elif audio_bytes[:4] == b'RIFF':
        return "wav"
    elif audio_bytes[:3] == b'ID3' or audio_bytes[:2] == b'\xff\xfb':
        return "mp3"
    elif audio_bytes[:4] == b'OggS':
        return "ogg"
    elif audio_bytes[:4] == b'fLaC':
        return "flac"
    elif len(audio_bytes) > 4 and audio_bytes[4:8] == b'ftyp':
        return "mp4"           # M4A / MP4 container
    else:
        # Fallback: infer from filename extension
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "wav"
        return ext if ext in ("wav", "mp3", "webm", "ogg", "flac", "m4a", "mp4") else "wav"


class TranscriptionResult:
    """Structured return from transcribe_audio()."""

    def __init__(self, text: str, success: bool, error: Optional[str] = None,
                 model: str = _DEFAULT_MODEL):
        self.text = text
        self.success = success
        self.error = error
        self.model = model

    def __repr__(self) -> str:
        status = "OK" if self.success else f"ERR: {self.error}"
        return f"TranscriptionResult({status}, {len(self.text)} chars)"


def transcribe_audio(
    audio_bytes: bytes,
    *,
    model: str = _DEFAULT_MODEL,
    language: Optional[str] = None,
    filename: str = "recording.wav",
    mime_type: Optional[str] = None,
) -> TranscriptionResult:
    """
    Transcribe audio bytes using OpenRouter's Whisper endpoint.

    Parameters
    ----------
    audio_bytes : bytes
        Raw audio data (WAV, MP3, WebM, M4A, etc.)
    model : str
        OpenRouter model identifier (default: whisper-large-v3).
    language : str | None
        Optional ISO-639-1 language hint (e.g. 'en', 'hi') for better accuracy.
    filename : str
        Filename hint (used for format detection fallback).
    mime_type : str | None
        Optional MIME type string from the client/browser.

    Returns
    -------
    TranscriptionResult with .text, .success, .error, .model
    """
    api_key = _get_openrouter_key()
    if not api_key:
        return TranscriptionResult(
            text="",
            success=False,
            error="OPENROUTER_API_KEY not configured — voice input unavailable.",
            model=model,
        )

    if not audio_bytes or len(audio_bytes) < 100:
        return TranscriptionResult(
            text="",
            success=False,
            error="Audio recording too short or empty.",
            model=model,
        )

    # ── Detect audio format & base64-encode ──────────────────────────────────
    audio_format = _detect_audio_format(audio_bytes, filename, mime_type)
    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    logger.info(
        "Voice input: %d bytes, detected format=%s, b64 length=%d",
        len(audio_bytes), audio_format, len(audio_b64),
    )

    # ── Build JSON request (OpenRouter expects base64 in input_audio) ────────
    payload: dict = {
        "model": model,
        "input_audio": {
            "data": audio_b64,
            "format": audio_format,
        },
    }
    if language:
        payload["language"] = language

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qaffeine.ai",
        "X-Title": "QAFFEINE Voice Input",
    }

    # ── Send request ─────────────────────────────────────────────────────────
    try:
        resp = requests.post(
            _OPENROUTER_TRANSCRIPTION_URL,
            headers=headers,
            json=payload,
            timeout=_TIMEOUT_SECONDS,
        )

        if resp.status_code == 200:
            body = resp.json()
            text = (body.get("text") or "").strip()
            if text:
                logger.info("Voice transcription OK (%d chars) via %s", len(text), model)
                return TranscriptionResult(text=text, success=True, model=model)
            return TranscriptionResult(
                text="", success=False,
                error="Transcription returned empty text — please try again.",
                model=model,
            )

        # ── Error handling ───────────────────────────────────────────────────
        error_detail = resp.text[:300]
        logger.warning("Voice transcription HTTP %d: %s", resp.status_code, error_detail)
        return TranscriptionResult(
            text="", success=False,
            error=f"Transcription API error (HTTP {resp.status_code}): {error_detail}",
            model=model,
        )

    except requests.exceptions.Timeout:
        logger.warning("Voice transcription timed out after %ds", _TIMEOUT_SECONDS)
        return TranscriptionResult(
            text="", success=False,
            error=f"Transcription timed out after {_TIMEOUT_SECONDS}s. Please try a shorter recording.",
            model=model,
        )
    except Exception as exc:
        logger.exception("Voice transcription exception")
        return TranscriptionResult(
            text="", success=False,
            error=f"Transcription error: {exc}",
            model=model,
        )

