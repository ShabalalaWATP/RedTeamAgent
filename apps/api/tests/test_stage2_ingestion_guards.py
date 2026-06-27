from __future__ import annotations

import asyncio
import subprocess
import tarfile
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from pypdf import PdfWriter

from app.domain.exceptions import ValidationFailure
from app.infrastructure.ingestion import code_archives, extractors, rich_extractors, web_sources
from app.infrastructure.ingestion.safe_http import PinnedHttpsResponse
from app.interfaces.api.routes.reviews import _read_bounded_upload


def test_stage2_website_ssrf_redirect_and_rebinding_guards(monkeypatch: pytest.MonkeyPatch) -> None:
    def public_fetch(url: str, pinned_addresses: list[str]) -> web_sources.FetchResponse:
        assert pinned_addresses == ["93.184.216.34"]
        return web_sources.FetchResponse(url, 200, {"content-type": "text/html"}, b"<p>Evidence</p>")

    monkeypatch.setattr(web_sources, "_fetch_once", public_fetch)
    for address in ["127.0.0.1", "10.0.0.1", "169.254.1.1", "::1", "fd00::1"]:
        monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname, value=address: [value])
        with pytest.raises(ValidationFailure):
            web_sources.website_snapshot("https://example.com/research", [], [])

    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://169.254.169.254/latest", [], [])
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("http://example.com/insecure", [], [])

    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url, pinned_addresses: web_sources.FetchResponse(
            url,
            302,
            {"location": "https://127.0.0.1/internal"},
            b"",
        ),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/redirect", [], [])

    addresses = iter([["93.184.216.34"], ["10.0.0.2"]])
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: next(addresses))
    monkeypatch.setattr(web_sources, "_fetch_once", public_fetch)
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/rebinding", [], [])

    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url, pinned_addresses: web_sources.FetchResponse(
            url,
            200,
            {"content-type": "text/plain"},
            b"x" * 1_000_001,
        ),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/too-large", [], [])


def test_stage2_website_fetch_redirect_success_and_low_level_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])

    def redirect_then_success(url: str, pinned_addresses: list[str]) -> web_sources.FetchResponse:
        assert pinned_addresses == ["93.184.216.34"]
        if url.endswith("/start"):
            return web_sources.FetchResponse(url, 302, {"location": "/final"}, b"")
        return web_sources.FetchResponse(
            url,
            200,
            {"content-type": "text/html"},
            b"<html><script>ignore()</script><p>Visible evidence</p></html>",
        )

    monkeypatch.setattr(web_sources, "_fetch_once", redirect_then_success)
    snapshot = web_sources.website_snapshot("https://example.com/start", ["example.com"], [])
    assert snapshot.final_url == "https://example.com/final"
    assert snapshot.extraction.metadata["redirect_chain"] == ["https://example.com/start", "https://example.com/final"]
    assert "Visible evidence" in snapshot.extraction.chunks[0].text
    assert "ignore" not in snapshot.extraction.chunks[0].text

    monkeypatch.undo()

    def fake_pinned_fetch(parsed, addresses, timeout, max_bytes, user_agent):
        assert parsed.geturl() == "https://example.com/raw"
        assert addresses == ["93.184.216.34"]
        assert timeout == web_sources.MAX_FETCH_TIMEOUT_SECONDS
        assert max_bytes == web_sources.MAX_WEBSITE_BYTES
        assert user_agent == "RedTeamAgent/Stage2"
        return PinnedHttpsResponse(200, {"content-type": "text/plain"}, b"raw evidence")

    monkeypatch.setattr(web_sources, "fetch_https_with_pinned_ip", fake_pinned_fetch)
    fetched = web_sources._fetch_once("https://example.com/raw", ["93.184.216.34"])
    assert fetched.body == b"raw evidence"
    assert fetched.headers["content-type"] == "text/plain"


def test_stage2_website_fetch_error_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url, pinned_addresses: web_sources.FetchResponse(url, 302, {}, b""),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/missing-location", [], [])

    monkeypatch.setattr(
        web_sources,
        "_fetch_once",
        lambda url, pinned_addresses: web_sources.FetchResponse(url, 500, {}, b""),
    )
    with pytest.raises(ValidationFailure):
        web_sources.website_snapshot("https://example.com/error", [], [])


def test_stage2_git_repository_helper_uses_no_checkout_and_caps(monkeypatch: pytest.MonkeyPatch) -> None:
    commands: list[list[str]] = []

    def fake_run_git(
        command: list[str],
        env: dict[str, str],
        cwd: str,
        timeout: int,
    ) -> subprocess.CompletedProcess[str]:
        del env, cwd, timeout
        commands.append(command)
        if "ls-tree" in command:
            return subprocess.CompletedProcess(command, 0, stdout="app.py\nimage.png\npackage.json\n")
        if command[-1] == "HEAD:app.py":
            return subprocess.CompletedProcess(command, 0, stdout="print('safe')\n")
        if command[-1] == "HEAD:package.json":
            return subprocess.CompletedProcess(command, 0, stdout='{"dependencies": {}}\n')
        return subprocess.CompletedProcess(command, 0, stdout="")

    monkeypatch.setattr(web_sources, "_run_git", fake_run_git)
    entries = web_sources._clone_repository_entries("https://github.com/example/repo.git")
    assert commands[0][0:3] == ["git", "-c", "protocol.file.allow=never"]
    assert "http.followRedirects=false" in commands[0]
    assert "--no-checkout" in commands[0]
    assert ("image.png", b"") in entries
    assert ("app.py", b"print('safe')\n") in entries


def test_stage2_repository_ingestion_rejects_unlisted_hosts_before_git(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(web_sources, "_resolve_host", lambda hostname: ["93.184.216.34"])
    monkeypatch.setattr(
        web_sources,
        "_run_git",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("git ran for unlisted host")),
    )

    with pytest.raises(ValidationFailure, match="Repository host is not in the ingestion allow-list"):
        web_sources.repository_snapshot("https://example.com/repo.git")


def test_stage2_git_subprocess_wrapper_success_and_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_subprocess_run(*args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        del args, kwargs
        return subprocess.CompletedProcess(["git"], 0, stdout="ok")

    monkeypatch.setattr(web_sources.subprocess, "run", fake_subprocess_run)
    assert web_sources._run_git(["git", "--version"], {}, ".", 1).stdout == "ok"

    def missing_git(*args: object, **kwargs: object) -> subprocess.CompletedProcess[str]:
        del args, kwargs
        raise FileNotFoundError

    monkeypatch.setattr(web_sources.subprocess, "run", missing_git)
    with pytest.raises(ValidationFailure):
        web_sources._run_git(["git"], {}, ".", 1)


def test_stage2_archive_rejects_oversized_zip_entry_before_read(monkeypatch: pytest.MonkeyPatch) -> None:
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("huge.py", b"x" * (code_archives.MAX_EXPANDED_BYTES + 1))

    def fail_if_read(*args: object, **kwargs: object) -> bytes:
        del args, kwargs
        raise AssertionError("oversized archive entry was read before size validation")

    monkeypatch.setattr(ZipFile, "read", fail_if_read)
    with pytest.raises(ValidationFailure, match="Archive expands beyond"):
        code_archives._zip_entries(output.getvalue())


def test_stage2_archive_rejects_unsafe_paths_before_read(monkeypatch: pytest.MonkeyPatch) -> None:
    zip_output = BytesIO()
    with ZipFile(zip_output, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("../evil.py", b"print('bad')\n")

    tar_output = BytesIO()
    with tarfile.open(fileobj=tar_output, mode="w") as archive:
        info = tarfile.TarInfo("../evil.py")
        payload = b"print('bad')\n"
        info.size = len(payload)
        archive.addfile(info, BytesIO(payload))

    def fail_if_read(*args: object, **kwargs: object) -> bytes:
        del args, kwargs
        raise AssertionError("unsafe archive path was read before validation")

    monkeypatch.setattr(ZipFile, "read", fail_if_read)
    with pytest.raises(ValidationFailure, match="Archive path is not safe"):
        code_archives._zip_entries(zip_output.getvalue())
    with pytest.raises(ValidationFailure, match="Archive path is not safe"):
        code_archives._tar_entries(tar_output.getvalue())


def test_stage2_office_extractors_reject_oversized_parts_before_read(monkeypatch: pytest.MonkeyPatch) -> None:
    pptx = BytesIO()
    with ZipFile(pptx, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("ppt/slides/slide1.xml", b"x" * (rich_extractors.MAX_OFFICE_XML_BYTES + 1))
    xlsx = BytesIO()
    with ZipFile(xlsx, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("xl/sharedStrings.xml", b"x" * (rich_extractors.MAX_OFFICE_XML_BYTES + 1))
        archive.writestr("xl/worksheets/sheet1.xml", b"<worksheet />")

    def fail_if_read(*args: object, **kwargs: object) -> bytes:
        del args, kwargs
        raise AssertionError("oversized Office part was read before size validation")

    monkeypatch.setattr(ZipFile, "read", fail_if_read)
    with pytest.raises(ValidationFailure, match="Office document expands"):
        rich_extractors.pptx_result("slides.pptx", pptx.getvalue())
    with pytest.raises(ValidationFailure, match="Office document expands"):
        rich_extractors.xlsx_result("sheet.xlsx", xlsx.getvalue())


def test_stage2_docx_extractor_rejects_oversized_parts_before_parser(monkeypatch: pytest.MonkeyPatch) -> None:
    docx = BytesIO()
    with ZipFile(docx, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", b"<Types />")
        archive.writestr("word/document.xml", b"x" * (extractors.MAX_DOCX_XML_BYTES + 1))

    monkeypatch.setattr(
        extractors,
        "Document",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("DOCX parser was reached")),
    )
    with pytest.raises(ValidationFailure, match="DOCX expands"):
        extractors.SourceExtractor().extract(
            "large.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            docx.getvalue(),
        )


def test_stage2_pdf_extractor_rejects_page_and_text_limits(monkeypatch: pytest.MonkeyPatch) -> None:
    many_pages = BytesIO()
    writer = PdfWriter()
    for _ in range(extractors.MAX_PDF_PAGES + 1):
        writer.add_blank_page(width=72, height=72)
    writer.write(many_pages)
    with pytest.raises(ValidationFailure, match="PDF contains too many pages"):
        extractors.SourceExtractor().extract("many.pdf", "application/pdf", many_pages.getvalue())

    class HugeTextPage:
        def extract_text(self) -> str:
            return "x" * (extractors.MAX_PDF_TEXT_CHARS + 1)

    class FakeHugeTextReader:
        pages = [HugeTextPage()]

        def __init__(self, stream: object) -> None:
            del stream

    monkeypatch.setattr(extractors, "PdfReader", FakeHugeTextReader)
    with pytest.raises(ValidationFailure, match="PDF text exceeds"):
        extractors.SourceExtractor().extract("huge.pdf", "application/pdf", b"%PDF")


def test_stage2_document_extractors_cover_bounded_text_branches(monkeypatch: pytest.MonkeyPatch) -> None:
    class TextPage:
        def extract_text(self) -> str:
            return "visible pdf text"

    class FakeTextReader:
        pages = [TextPage()]

        def __init__(self, stream: object) -> None:
            del stream

    class Paragraph:
        def __init__(self, text: str) -> None:
            self.text = text

    class TooManyParagraphs:
        paragraphs = [Paragraph("x")] * (extractors.MAX_DOCX_PARAGRAPHS + 1)

    monkeypatch.setattr(extractors, "PdfReader", FakeTextReader)
    pdf = extractors.SourceExtractor().extract("text.pdf", "application/pdf", b"%PDF")
    assert pdf.chunks[0].text == "visible pdf text"

    monkeypatch.setattr(extractors, "_validate_docx_archive", lambda content: None)
    monkeypatch.setattr(extractors, "Document", lambda stream: TooManyParagraphs())
    with pytest.raises(ValidationFailure, match="DOCX contains too many paragraphs"):
        extractors.SourceExtractor().extract(
            "too-many.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"docx",
        )


def test_stage2_upload_reader_stops_at_configured_limit() -> None:
    upload = FakeUpload([b"a" * 4, b"b" * 4, b"c" * 4])

    with pytest.raises(ValidationFailure, match="Upload exceeds"):
        asyncio.run(_read_bounded_upload(upload, 10))

    assert upload.reads == 3
    allowed = FakeUpload([b"a" * 4, b"b" * 4])
    assert asyncio.run(_read_bounded_upload(allowed, 10)) == b"aaaabbbb"


class FakeUpload:
    def __init__(self, chunks: list[bytes]) -> None:
        self.chunks = chunks
        self.reads = 0

    async def read(self, size: int) -> bytes:
        assert size > 0
        self.reads += 1
        return self.chunks.pop(0) if self.chunks else b""
