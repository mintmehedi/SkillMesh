"""
PDF text extraction tuned for resumes: reading order + fallback.

PyMuPDF (fitz) usually outperforms plain pypdf on multi-column and ordered blocks.
"""
from __future__ import annotations

import os
from io import BytesIO

from pypdf import PdfReader


def _env_choice(key: str, default: str) -> str:
    v = (os.environ.get(key) or default).strip().lower()
    return v if v in {"pymupdf", "pypdf", "auto"} else default


def _pypdf_extract(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _pymupdf_extract(content: bytes) -> str:
    import fitz

    doc = fitz.open(stream=content, filetype="pdf")
    try:
        parts = []
        for page in doc:
            # sort=True orders text blocks for human reading order (columns, headers).
            block = page.get_text("text", sort=True) or ""
            parts.append(block)
        return "\n".join(parts)
    finally:
        doc.close()


def extract_pdf_text(content: bytes) -> str:
    mode = _env_choice("PDF_EXTRACT_ENGINE", "auto")
    if mode == "pypdf":
        return _pypdf_extract(content)
    if mode == "pymupdf":
        try:
            return _pymupdf_extract(content)
        except Exception:
            return _pypdf_extract(content)

    # auto: PyMuPDF first; if output is too thin (scanned PDF or odd encoding), try pypdf.
    try:
        primary = _pymupdf_extract(content)
    except Exception:
        return _pypdf_extract(content)

    stripped = primary.strip()
    try:
        min_chars = max(40, int((os.environ.get("PDF_FALLBACK_MIN_CHARS") or "80").strip()))
    except ValueError:
        min_chars = 80
    if len(stripped) >= min_chars:
        return primary

    fallback = _pypdf_extract(content)
    if len(fallback.strip()) > len(stripped):
        return fallback
    return primary
