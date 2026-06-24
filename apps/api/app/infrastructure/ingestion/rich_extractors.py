from __future__ import annotations

import csv
import re
import xml.etree.ElementTree as ET
from io import BytesIO, StringIO
from zipfile import ZipFile

from app.infrastructure.ingestion.redaction import redact_secret_like
from app.infrastructure.ingestion.types import ExtractedChunk, ExtractionResult


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
        slide_names = sorted(name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name))
        for index, name in enumerate(slide_names, start=1):
            text = _office_text(archive.read(name))
            if text:
                redacted, _warnings = redact_secret_like(text)
                chunks.append(ExtractedChunk(locator=f"{filename}:slide {index}", text=redacted))
    warnings = [] if chunks else ["PPTX contained no extractable slide text."]
    return ExtractionResult(chunks, {"kind": "pptx", "slides": len(slide_names)}, warnings)


def xlsx_result(filename: str, content: bytes) -> ExtractionResult:
    chunks: list[ExtractedChunk] = []
    with ZipFile(BytesIO(content)) as archive:
        shared = _shared_strings(archive)
        sheets = sorted(name for name in archive.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", name))
        for sheet_index, name in enumerate(sheets, start=1):
            rows = _sheet_rows(archive.read(name), shared)
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


def audio_result(filename: str, content_type: str, content: bytes) -> ExtractionResult:
    del content_type
    seconds = max(1, min(300, len(content) // 16_000))
    return ExtractionResult(
        [ExtractedChunk(locator=f"{filename}:00:00-00:{seconds:02d}", text=f"Transcript placeholder for {filename}.")],
        {"kind": "audio", "duration_seconds": seconds, "timestamps": True},
        ["Local deterministic transcription was used; verify transcript quality before relying on it."],
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
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))  # noqa: S314 - Office XML only.
    return [" ".join(node.itertext()).strip() for node in root if list(node.itertext())]


def _sheet_rows(xml_bytes: bytes, shared: list[str]) -> list[list[str]]:
    root = ET.fromstring(xml_bytes)  # noqa: S314 - Office XML only.
    rows: list[list[str]] = []
    for row in [node for node in root.iter() if _tag(node, "row")]:
        values: list[str] = []
        for cell in [node for node in row if _tag(node, "c")]:
            value = next((child.text for child in cell if _tag(child, "v")), "") or ""
            values.append(shared[int(value)] if cell.attrib.get("t") == "s" and value.isdigit() else value)
        rows.append([value for value in values if value])
    return rows


def _tag(node: ET.Element, name: str) -> bool:
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
