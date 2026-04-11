import base64
import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .image_preprocess import prepare_image_for_ocr


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


def extract_text_with_cloud_ocr(file_name: str, content_bytes: bytes) -> str:
    api_key = os.environ.get("OCR_SPACE_API_KEY", "").strip()
    if not api_key:
        return ""

    image_bytes, mime_subtype = prepare_image_for_ocr(content_bytes, file_name)
    encoded = base64.b64encode(image_bytes).decode("ascii")

    engine = str(_env_int("OCR_SPACE_ENGINE", 2))
    if engine not in ("1", "2"):
        engine = "2"

    payload = urlencode(
        {
            "apikey": api_key,
            "language": os.environ.get("OCR_SPACE_LANGUAGE", "eng").strip() or "eng",
            # Keep false unless we consume TextOverlay for reading order (we don't).
            "isOverlayRequired": "false",
            "isTable": "true" if _env_bool("OCR_SPACE_IS_TABLE", False) else "false",
            "OCREngine": engine,
            "detectOrientation": "true" if _env_bool("OCR_SPACE_DETECT_ORIENTATION", True) else "false",
            "scale": "true" if _env_bool("OCR_SPACE_SCALE", False) else "false",
            "base64Image": f"data:image/{mime_subtype};base64,{encoded}",
        }
    ).encode("utf-8")

    timeout = max(15, _env_int("OCR_SPACE_TIMEOUT_SEC", 45))
    req = Request(
        "https://api.ocr.space/parse/image",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlopen(req, timeout=timeout) as res:  # nosec B310 (fixed trusted endpoint)
        body = json.loads(res.read().decode("utf-8"))

    if body.get("IsErroredOnProcessing"):
        return ""

    parsed_results = body.get("ParsedResults") or []
    return "\n".join((r.get("ParsedText") or "").strip() for r in parsed_results if isinstance(r, dict)).strip()
