"""Shared upload checks: size limits and basic magic-byte validation."""

from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from core.upload_scan import scan_upload_for_malware

_PDF = b"%PDF"
_PNG = b"\x89PNG\r\n\x1a\n"
_JPEG = b"\xff\xd8\xff"
_ZIP = b"PK\x03\x04"

_EXT_SNIFF = {
    ".pdf": (_PDF,),
    ".docx": (_ZIP,),
    ".png": (_PNG,),
    ".jpg": (_JPEG,),
    ".jpeg": (_JPEG,),
}


def _read_head(uploaded_file, n: int = 16) -> bytes:
    pos = uploaded_file.tell()
    try:
        uploaded_file.seek(0)
        return uploaded_file.read(n)
    finally:
        uploaded_file.seek(pos)


def validate_upload_file(uploaded_file, *, allowed_extensions: tuple[str, ...], max_bytes: int | None = None):
    """
    Reject uploads that exceed max_bytes or whose content does not match the extension.
    """
    if uploaded_file is None:
        return uploaded_file

    limit = max_bytes if max_bytes is not None else getattr(settings, "MAX_UPLOAD_SIZE_BYTES", 10 * 1024 * 1024)
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > limit:
        mb = max(1, limit // (1024 * 1024))
        raise serializers.ValidationError(f"File is too large (maximum {mb} MB).")

    name = (getattr(uploaded_file, "name", None) or "").lower()
    ext = Path(name).suffix
    if ext not in allowed_extensions:
        raise serializers.ValidationError(
            f"Unsupported file type. Allowed: {', '.join(sorted(allowed_extensions))}."
        )

    head = _read_head(uploaded_file)
    prefixes = _EXT_SNIFF.get(ext)
    if prefixes and not any(head.startswith(p) for p in prefixes):
        raise serializers.ValidationError("File content does not match its extension.")

    scan_upload_for_malware(uploaded_file)
    return uploaded_file
