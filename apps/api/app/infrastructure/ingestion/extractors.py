from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from docx import Document
from pypdf import PdfReader

from app.domain.exceptions import ValidationFailure


@dataclass(frozen=True)
class ExtractedChunk:
    locator: str
    text: str


@dataclass(frozen=True)
class ExtractionResult:
    chunks: list[ExtractedChunk]
    metadata: dict[str, object]
    warnings: list[str]


class SourceExtractor:
    def extract(self, filename: str, content_type: str, content: bytes) -> ExtractionResult:
        if content_type in {"text/plain", "text/markdown"}:
            return self._text(filename, content)
        if content_type == "application/pdf":
            return self._pdf(content)
        if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return self._docx(content)
        raise ValidationFailure("Unsupported source type.")

    def _text(self, filename: str, content: bytes) -> ExtractionResult:
        text = content.decode("utf-8", errors="replace")
        warnings = ["Replacement characters were used during text decoding."] if "\ufffd" in text else []
        return ExtractionResult(
            chunks=[ExtractedChunk(locator=f"{filename}:1", text=text)],
            metadata={"kind": "text", "characters": len(text)},
            warnings=warnings,
        )

    def _pdf(self, content: bytes) -> ExtractionResult:
        reader = PdfReader(BytesIO(content))
        chunks: list[ExtractedChunk] = []
        warnings: list[str] = []
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                chunks.append(ExtractedChunk(locator=f"page {index}", text=text))
            else:
                warnings.append(f"Page {index} produced no extractable text.")
        return ExtractionResult(chunks=chunks, metadata={"kind": "pdf", "pages": len(reader.pages)}, warnings=warnings)

    def _docx(self, content: bytes) -> ExtractionResult:
        document = Document(BytesIO(content))
        chunks = [
            ExtractedChunk(locator=f"paragraph {index}", text=paragraph.text)
            for index, paragraph in enumerate(document.paragraphs, start=1)
            if paragraph.text.strip()
        ]
        return ExtractionResult(
            chunks=chunks,
            metadata={"kind": "docx", "paragraphs": len(document.paragraphs)},
            warnings=[] if chunks else ["DOCX contained no extractable paragraph text."],
        )
