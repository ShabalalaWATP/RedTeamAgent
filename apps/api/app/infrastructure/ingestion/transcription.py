from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from app.domain.policies import validate_provider_endpoint

MAX_TRANSCRIPTION_RESPONSE_BYTES = 200_000
DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
TRANSCRIPTION_URL_BUILDERS = {
    "openai": lambda config: "https://api.openai.com/v1/audio/transcriptions",
    "openai_compatible": lambda config: _openai_compatible_transcription_url(config),
}


class ProviderAudioTranscriber:
    def transcribe(
        self,
        *,
        provider: str,
        config: dict[str, object],
        credentials: dict[str, str],
        filename: str,
        content_type: str,
        content: bytes,
    ) -> str | None:
        api_key = credentials.get("api_key")
        url_builder = TRANSCRIPTION_URL_BUILDERS.get(provider)
        if not api_key or url_builder is None:
            return None
        url = url_builder(config)
        if url is None:
            return None
        model = str(config.get("transcription_model") or DEFAULT_TRANSCRIPTION_MODEL)
        body, boundary = _multipart_body(model, filename, content_type, content)
        request = Request(  # noqa: S310
            url,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "Accept": "application/json",
            },
        )
        payload = _request_json(request, _timeout(config))
        text = payload.get("text")
        return str(text).strip() if text else None


def _openai_compatible_transcription_url(config: dict[str, object]) -> str | None:
    endpoint = str(config.get("endpoint_url") or "").rstrip("/")
    if not endpoint:
        return None
    url = f"{endpoint}/audio/transcriptions"
    validate_provider_endpoint(url, False)
    _require_https(url)
    return url


def _multipart_body(model: str, filename: str, content_type: str, content: bytes) -> tuple[bytes, str]:
    boundary = f"rta-{uuid4().hex}"
    parts = [
        _field(boundary, "model", model.encode("utf-8")),
        _field(boundary, "response_format", b"json"),
        _file_field(boundary, "file", _safe_filename(filename), content_type, content),
        f"--{boundary}--\r\n".encode("ascii"),
    ]
    return b"".join(parts), boundary


def _field(boundary: str, name: str, value: bytes) -> bytes:
    return (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
    ).encode("ascii") + value + b"\r\n"


def _file_field(boundary: str, name: str, filename: str, content_type: str, content: bytes) -> bytes:
    return (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode() + content + b"\r\n"


def _request_json(request: Request, timeout: int) -> dict[str, object]:
    try:
        with build_opener(_NoRedirectHandler).open(request, timeout=timeout) as response:  # noqa: S310
            payload = json.loads(_read_response(response).decode("utf-8"))
    except HTTPError as exc:
        if 300 <= exc.code < 400:
            raise RuntimeError("Transcription provider redirects are not allowed.") from exc
        raise RuntimeError("Transcription provider rejected the audio upload.") from exc
    except (URLError, json.JSONDecodeError) as exc:
        raise RuntimeError("Transcription provider did not return a valid response.") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("Transcription provider response was not a JSON object.")
    return payload


def _read_response(response: object) -> bytes:
    body = response.read(MAX_TRANSCRIPTION_RESPONSE_BYTES + 1)  # type: ignore[attr-defined]
    if len(body) > MAX_TRANSCRIPTION_RESPONSE_BYTES:
        raise RuntimeError("Transcription provider response exceeds the configured size limit.")
    return body


def _timeout(config: dict[str, object]) -> int:
    try:
        value = int(str(config.get("timeout_seconds", 30)))
    except (TypeError, ValueError):
        value = 30
    return min(max(value, 1), 120)


def _safe_filename(filename: str) -> str:
    clean = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1] or "voice-note.webm"
    return clean.replace('"', "")


def _require_https(url: str) -> None:
    if urlparse(url).scheme != "https":
        raise RuntimeError("Transcription provider URL must use HTTPS.")


class _NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, *args: object, **kwargs: object) -> None:
        del args, kwargs
        return None
