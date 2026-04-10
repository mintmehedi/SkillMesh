import base64
import json
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def extract_text_with_cloud_ocr(file_name, content_bytes):
    api_key = os.environ.get("OCR_SPACE_API_KEY", "").strip()
    if not api_key:
        return ""

    encoded = base64.b64encode(content_bytes).decode("ascii")
    payload = urlencode(
        {
            "apikey": api_key,
            "language": "eng",
            "isOverlayRequired": "false",
            "isTable": "false",
            "OCREngine": "2",
            "base64Image": f"data:image/{_ext_to_mime(file_name)};base64,{encoded}",
        }
    ).encode("utf-8")
    req = Request(
        "https://api.ocr.space/parse/image",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlopen(req, timeout=20) as res:  # nosec B310 (fixed trusted endpoint)
        body = json.loads(res.read().decode("utf-8"))
    parsed_results = body.get("ParsedResults") or []
    return "\n".join((r.get("ParsedText") or "").strip() for r in parsed_results).strip()


def _ext_to_mime(file_name):
    lower = (file_name or "").lower()
    if lower.endswith(".png"):
        return "png"
    if lower.endswith(".jpeg") or lower.endswith(".jpg"):
        return "jpeg"
    return "jpeg"

