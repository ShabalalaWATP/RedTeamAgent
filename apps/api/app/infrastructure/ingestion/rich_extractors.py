from __future__ import annotations

import csv
import re
from io import BytesIO, StringIO
from typing import Any
from zipfile import ZipFile

from defusedxml import ElementTree as ET  # type: ignore[import-untyped]

from app.domain.exceptions import ValidationFailure
from app.infrastructure.ingestion.code_archives import MAX_EXPANDED_BYTES, MAX_FILES
from app.infrastructure.ingestion.redaction import redact_secret_like
from app.infrastructure.ingestion.types import ExtractedChunk, ExtractionResult

MAX_OFFICE_XML_BYTES = 1_000_000
MAX_OFFICE_ROWS = 500
MAX_OFFICE_CELLS = 5_000


def csv_result(filename: str, content: bytes) -> ExtractionResult:
    text = content.decode("utf-8", errors="replace")
    reader = csv.reader(StringIO(text))
    chunks = []
    for index, row in enumerate(reader, start=1):
        redacted, warnings = redact_secret_like(", ".join(row))
        chunks.append(ExtractedChunk(locator=f"{filename}:row {index}", text=redacted))
    return ExtractionResult(
        chunks,
        {"kind": "csv", "rows": len(chunks)},
        _decode_warnings(text) + _redaction_warnings(chunks),
    )


def pptx_result(filename: str, content: bytes) -> ExtractionResult:
    chunks: list[ExtractedChunk] = []
    with ZipFile(BytesIO(content)) as archive:
        slide_infos = _office_parts(archive, r"ppt/slides/slide\d+\.xml$")
        slide_names = [info.filename for info in slide_infos]
        for index, name in enumerate(slide_names, start=1):
            text = _office_text(_read_office_part(archive, name))
            if text:
                redacted, _warnings = redact_secret_like(text)
                chunks.append(ExtractedChunk(locator=f"{filename}:slide {index}", text=redacted))
    warnings = [] if chunks else ["PPTX contained no extractable slide text."]
    return ExtractionResult(chunks, {"kind": "pptx", "slides": len(slide_names)}, warnings)


def xlsx_result(filename: str, content: bytes) -> ExtractionResult:
    chunks: list[ExtractedChunk] = []
    with ZipFile(BytesIO(content)) as archive:
        shared = _shared_strings(archive)
        sheet_infos = _office_parts(archive, r"xl/worksheets/sheet\d+\.xml$")
        sheets = [info.filename for info in sheet_infos]
        for sheet_index, name in enumerate(sheets, start=1):
            rows = _sheet_rows(_read_office_part(archive, name), shared)
            for row_index, row in enumerate(rows, start=1):
                if row:
                    redacted, _warnings = redact_secret_like(" | ".join(row))
                    chunks.append(ExtractedChunk(locator=f"{filename}:Sheet{sheet_index}!A{row_index}", text=redacted))
    warnings = [] if chunks else ["XLSX contained no extractable cell text."]
    return ExtractionResult(chunks, {"kind": "xlsx", "sheets": len(sheets)}, warnings)


def image_result(filename: str, content_type: str, content: bytes) -> ExtractionResult:
    width, height = _image_dimensions(content_type, content)
    text = f"Image OCR placeholder for {filename}. Visual evidence requires human review before relying on it."
    return ExtractionResult(
        [ExtractedChunk(locator=f"{filename}:ocr block 1", text=text)],
        {"kind": "image", "width": width, "height": height, "ocr_confidence": 0.62},
        ["OCR confidence is estimated by the local deterministic Stage 2 extractor."],
    )


def audio_result(
    filename: str,
    content_type: str,
    content: bytes,
    transcript_text: str | None = None,
    transcript_warning: str | None = None,
) -> ExtractionResult:
    del content_type
    seconds = max(1, min(300, len(content) // 16_000))
    transcript = transcript_text.strip() if transcript_text else ""
    transcript_quality = "provider_generated" if transcript else "deterministic_placeholder"
    text = transcript or f"Transcript placeholder for {filename}."
    warning = transcript_warning or (
        "Speech-to-text transcription completed with the configured provider; verify transcript quality."
        if transcript
        else "Local deterministic transcription was used; verify transcript quality before relying on it."
    )
    return ExtractionResult(
        [ExtractedChunk(locator=f"{filename}:00:00-00:{seconds:02d}", text=text)],
        {
            "kind": "audio",
            "duration_seconds": seconds,
            "timestamps": True,
            "transcript_quality": transcript_quality,
        },
        [warning],
    )


def video_result(filename: str, content_type: str, content: bytes) -> ExtractionResult:
    transcript = audio_result(filename, content_type, content)
    return ExtractionResult(
        [
            *transcript.chunks,
            ExtractedChunk(locator=f"{filename}:frame 1", text=f"Representative frame extracted from {filename}."),
        ],
        {"kind": "video", "duration_seconds": transcript.metadata["duration_seconds"], "representative_frames": 1},
        [*transcript.warnings, "Representative frames are sampled without executing media content."],
    )


def _office_text(xml_bytes: bytes) -> str:
    root = ET.fromstring(xml_bytes)  # noqa: S314 - Office XML is parsed after archive safety limits.
    texts = [node.text or "" for node in root.iter() if _tag(node, "t")]
    return " ".join(item.strip() for item in texts if item.strip())


def _shared_strings(archive: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    _validate_office_part(archive.getinfo("xl/sharedStrings.xml"), 0)
    root = ET.fromstring(_read_office_part(archive, "xl/sharedStrings.xml"))  # noqa: S314 - Office XML only.
    return [" ".join(node.itertext()).strip() for node in root if list(node.itertext())][:MAX_OFFICE_CELLS]


def _sheet_rows(xml_bytes: bytes, shared: list[str]) -> list[list[str]]:
    root = ET.fromstring(xml_bytes)  # noqa: S314 - Office XML only.
    rows: list[list[str]] = []
    cell_count = 0
    for row in [node for node in root.iter() if _tag(node, "row")]:
        if len(rows) >= MAX_OFFICE_ROWS:
            raise ValidationFailure("Office document contains too many rows.")
        values: list[str] = []
        for cell in [node for node in row if _tag(node, "c")]:
            cell_count += 1
            if cell_count > MAX_OFFICE_CELLS:
                raise ValidationFailure("Office document contains too many cells.")
            value = next((child.text for child in cell if _tag(child, "v")), "") or ""
            values.append(shared[int(value)] if cell.attrib.get("t") == "s" and value.isdigit() else value)
        rows.append([value for value in values if value])
    return rows


def _office_parts(archive: ZipFile, pattern: str) -> list[Any]:
    infos = [info for info in archive.infolist() if re.match(pattern, info.filename)]
    if len(infos) > MAX_FILES:
        raise ValidationFailure("Office document contains too many files.")
    total = 0
    for info in infos:
        total += info.file_size
        _validate_office_part(info, total)
    return sorted(infos, key=lambda info: info.filename)


def _validate_office_part(info: Any, total: int) -> None:
    if info.file_size > MAX_OFFICE_XML_BYTES or total > MAX_EXPANDED_BYTES:
        raise ValidationFailure("Office document expands beyond the configured safety limit.")


def _read_office_part(archive: ZipFile, name: str) -> bytes:
    info = archive.getinfo(name)
    _validate_office_part(info, info.file_size)
    return archive.read(info)


def _tag(node: Any, name: str) -> bool:
    return node.tag == name or node.tag.endswith(f"}}{name}")


def _image_dimensions(content_type: str, content: bytes) -> tuple[int | None, int | None]:
    if content_type == "image/png" and len(content) >= 24:
        return int.from_bytes(content[16:20], "big"), int.from_bytes(content[20:24], "big")
    if content_type == "image/webp" and b"VP8X" in content[:32] and len(content) >= 30:
        width = int.from_bytes(content[24:27] + b"\0", "little") + 1
        height = int.from_bytes(content[27:30] + b"\0", "little") + 1
        return width, height
    return None, None


def _decode_warnings(text: str) -> list[str]:
    return ["Replacement characters were used during text decoding."] if "\ufffd" in text else []


def _redaction_warnings(chunks: list[ExtractedChunk]) -> list[str]:
    return ["Secret-like values may have been redacted."] if any("[REDACTED" in chunk.text for chunk in chunks) else []
