"""
Resize and lightly enhance résumé images before cloud OCR.

Uses Pillow only (no OpenCV). Safe to disable via OCR_IMAGE_PREPROCESS=false.
"""
from __future__ import annotations

import io
import os
from typing import Tuple


def _env_bool(key: str, default: bool) -> bool:
    v = os.environ.get(key, "").strip().lower()
    if v == "":
        return default
    return v in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, "").strip() or default)
    except ValueError:
        return default


def _mime_from_filename(file_name: str) -> str:
    lower = (file_name or "").lower()
    if lower.endswith(".png"):
        return "png"
    if lower.endswith((".jpeg", ".jpg")):
        return "jpeg"
    return "jpeg"


def prepare_image_for_ocr(content: bytes, original_name: str) -> Tuple[bytes, str]:
    """
    Returns (image_bytes, mime_subtype for data URL) e.g. (b"...", "jpeg").
    On skip or failure, returns original content and mime inferred from filename.
    """
    mime = _mime_from_filename(original_name)
    if not _env_bool("OCR_IMAGE_PREPROCESS", True):
        return content, mime

    try:
        from PIL import Image, ImageOps
    except ImportError:
        return content, mime

    try:
        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img = img.convert("L")
        # Mild contrast stretch; cutoff ignores extreme percentiles (noise).
        img = ImageOps.autocontrast(img, cutoff=1)

        max_edge = max(800, _env_int("OCR_IMAGE_MAX_EDGE", 2200))
        min_target = max(400, _env_int("OCR_IMAGE_MIN_LONG_EDGE", 1000))
        w, h = img.size
        long_edge = max(w, h)
        short_edge = min(w, h)

        # Downscale very large photos (API limits + faster OCR).
        if long_edge > max_edge:
            scale = max_edge / float(long_edge)
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            w, h = img.size
            long_edge = max(w, h)

        # Upscale small scans so body text isn't tiny for OCR.
        if long_edge < min_target and long_edge > 0:
            scale = min_target / float(long_edge)
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        jpg_q = max(60, min(100, _env_int("OCR_JPEG_QUALITY", 90)))
        img.save(buf, format="JPEG", quality=jpg_q, optimize=True)
        return buf.getvalue(), "jpeg"
    except Exception:
        return content, mime
