"""
Optional OpenAI-compatible LLM extraction for work_experiences and studies (education).

Used when RESUME_LLM_ENABLED and an API key are set; otherwise skipped.
"""
from __future__ import annotations

import json
import logging
import os
import re
from copy import deepcopy
from typing import Any

from django.utils.dateparse import parse_date

from .resume_parser import _parse_single_date_token

logger = logging.getLogger(__name__)

_MAX_ROWS = 8
_MAX_STUDY = 8
_DEFAULT_MAX_INPUT = 12000
_DEFAULT_MAX_OUTPUT = 6144
_DEFAULT_MODEL = "gpt-4o-mini"
_DEFAULT_BASE = "https://api.openai.com/v1"


def _env_bool(key: str, default: bool = False) -> bool:
    v = os.environ.get(key, "").strip().lower()
    if v == "":
        return default
    return v in ("1", "true", "yes", "on")


def _env_int(key: str, default: int) -> int:
    try:
        return int((os.environ.get(key) or "").strip() or default)
    except ValueError:
        return default


def llm_work_experience_configured() -> bool:
    if not _env_bool("RESUME_LLM_ENABLED", False):
        return False
    key = (os.environ.get("OPENAI_API_KEY") or os.environ.get("LLM_API_KEY") or "").strip()
    return bool(key)


def _api_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or os.environ.get("LLM_API_KEY") or "").strip()


def _base_url() -> str:
    return (
        os.environ.get("RESUME_LLM_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
        or _DEFAULT_BASE
    ).rstrip("/")


def _model() -> str:
    return (os.environ.get("RESUME_LLM_MODEL") or _DEFAULT_MODEL).strip()


def _truncate(raw_text: str) -> str:
    max_chars = max(2000, _env_int("RESUME_LLM_MAX_INPUT_CHARS", _DEFAULT_MAX_INPUT))
    t = (raw_text or "").strip()
    if len(t) <= max_chars:
        return t
    return t[: max_chars - 20] + "\n\n[...truncated...]"


def _strip_json_fence(content: str) -> str:
    s = (content or "").strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```\s*$", s, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return s


def _normalize_date_value(val: Any) -> str | None:
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        y = int(val)
        if 1950 <= y <= 2035:
            return f"{y}-01-01"
        return None
    if isinstance(val, str):
        s = val.strip()
        if not s or s.lower() in ("null", "none", "n/a"):
            return None
        if re.match(r"^\d{4}$", s):
            return f"{s}-01-01"
        d = parse_date(s[:10])
        if d:
            return d.isoformat()
        parsed = _parse_single_date_token(s)
        return parsed or None
    return None


def validate_and_normalize_llm_work_experiences(rows: Any) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for idx, row in enumerate(rows[:_MAX_ROWS]):
        if not isinstance(row, dict):
            continue
        title = str(row.get("job_title") or "").strip()
        if len(title) < 2 or len(title) > 255:
            continue
        company = str(row.get("company_name") or "").strip()[:255]
        desc = str(row.get("description") or "").strip()[:1200]
        is_current = bool(row.get("is_current", False))
        start = _normalize_date_value(row.get("start_date"))
        end = _normalize_date_value(row.get("end_date"))
        if is_current:
            end = None
        has_signal = bool(company or start or end or is_current)
        if not has_signal and len(desc) < 25:
            continue
        out.append(
            {
                "job_title": title,
                "company_name": company,
                "description": desc,
                "start_date": start or "",
                "end_date": end or "",
                "is_current": is_current,
                "sort_order": idx,
            }
        )
    return out


def validate_and_normalize_llm_studies(rows: Any) -> list[dict[str, Any]]:
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for idx, row in enumerate(rows[:_MAX_STUDY]):
        if not isinstance(row, dict):
            continue
        institution = str(row.get("institution") or "").strip()[:255]
        degree = str(row.get("degree") or "").strip()[:255]
        field_of_study = str(row.get("field_of_study") or "").strip()[:255]
        major = str(row.get("major") or "").strip()[:255]
        desc = str(row.get("description") or "").strip()[:1200]
        is_current = bool(row.get("is_current", False))
        start = _normalize_date_value(row.get("start_date"))
        end = _normalize_date_value(row.get("end_date"))
        if is_current:
            end = None
        if max(len(institution), len(degree), len(field_of_study), len(major)) < 2:
            continue
        if not institution and not degree and len(field_of_study) < 3 and len(major) < 3 and len(desc) < 20:
            continue
        out.append(
            {
                "institution": institution,
                "degree": degree,
                "field_of_study": field_of_study,
                "major": major or field_of_study,
                "description": desc,
                "start_date": start or "",
                "end_date": end or "",
                "is_current": is_current,
                "sort_order": idx,
            }
        )
    return out


def _call_chat_completions(messages: list[dict[str, str]]) -> str:
    try:
        from openai import OpenAI
    except ImportError as e:
        raise RuntimeError("openai package is required for RESUME_LLM") from e

    timeout_sec = float(max(10, _env_int("RESUME_LLM_TIMEOUT_SEC", 45)))
    client = OpenAI(
        api_key=_api_key(),
        base_url=_base_url(),
        timeout=timeout_sec,
        max_retries=1,
    )
    max_out = max(512, _env_int("RESUME_LLM_MAX_OUTPUT_TOKENS", _DEFAULT_MAX_OUTPUT))
    kwargs: dict[str, Any] = {
        "model": _model(),
        "messages": messages,
        "max_tokens": max_out,
        "temperature": 0.1,
    }
    if _env_bool("RESUME_LLM_JSON_RESPONSE_FORMAT", True):
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    choice = resp.choices[0] if resp.choices else None
    if not choice or not choice.message or not choice.message.content:
        return ""
    return choice.message.content


def fetch_llm_resume_enrichment(raw_text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]] | None:
    """One LLM call: validated work_experiences and studies lists. None if disabled or request failed."""
    if not llm_work_experience_configured():
        return None
    text = _truncate(raw_text)
    if len(text) < 50:
        return None

    schema = (
        '{"work_experiences":[{"job_title":"string","company_name":"string","description":"string",'
        '"start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","is_current":false}],'
        '"studies":[{"institution":"string","degree":"string","field_of_study":"string","major":"string",'
        '"description":"string","start_date":"YYYY-MM-DD or null","end_date":"YYYY-MM-DD or null","is_current":false}]}'
    )
    user_msg = (
        "From the résumé plain text below, extract (1) paid jobs/internships as work_experiences, "
        "(2) formal education as studies (university, TAFE, college, bootcamp with credential). "
        "Return one JSON object with exactly two keys: work_experiences (array, max 8, most recent first) "
        "and studies (array, max 8, most recent first). "
        "For work: job_title, company_name, description, start_date, end_date (YYYY-MM-DD or null), is_current. "
        "For studies: institution, degree (e.g. Bachelor of Science), field_of_study, major (if distinct), "
        "description, start_date, end_date, is_current if still enrolled. "
        "Use null for unknown dates; year-only as YYYY-01-01. Do not invent names not in the text. "
        f"Example shape: {schema}\n\n---RÉSUMÉ TEXT---\n{text}"
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You convert noisy résumé text into strict JSON with work_experiences and studies. "
                "Respond with JSON only, no markdown fences."
            ),
        },
        {"role": "user", "content": user_msg},
    ]
    try:
        content = _call_chat_completions(messages)
        payload = json.loads(_strip_json_fence(content))
    except Exception as exc:
        logger.warning("resume LLM parse failed: %s", exc)
        return None

    if not isinstance(payload, dict):
        return None
    w_raw = (
        payload.get("work_experiences")
        or payload.get("workExperiences")
        or payload.get("experiences")
        or payload.get("employment")
        or payload.get("jobs")
    )
    s_raw = payload.get("studies") or payload.get("education") or payload.get("education_entries")
    work = validate_and_normalize_llm_work_experiences(w_raw)
    studies = validate_and_normalize_llm_studies(s_raw)
    return (work, studies)


def fetch_llm_work_experiences(raw_text: str) -> list[dict[str, Any]] | None:
    r = fetch_llm_resume_enrichment(raw_text)
    if r is None:
        return None
    w, _s = r
    return w if w else None


def apply_llm_resume_if_configured(parsed: dict[str, Any], raw_text: str) -> dict[str, Any]:
    """Merge LLM work_experiences and studies with heuristics (single API call when enabled)."""
    out = deepcopy(parsed)
    if not llm_work_experience_configured():
        return out
    try:
        enriched = fetch_llm_resume_enrichment(raw_text)
    except Exception:
        logger.exception("resume LLM fetch failed unexpectedly")
        enriched = None

    meta = out.setdefault("_parse_meta", {})
    if not isinstance(meta, dict):
        meta = {}
        out["_parse_meta"] = meta

    if enriched is None:
        meta["work_experience_source"] = "heuristic"
        meta["studies_source"] = "heuristic"
        return out

    llm_w, llm_s = enriched
    h_w = list(out.get("work_experiences") or [])
    h_n, l_n = len(h_w), len(llm_w)

    if llm_w and (h_n == 0 or l_n > h_n):
        out["work_experiences"] = llm_w
        prev = float(out.get("experience_parse_confidence") or 0)
        out["experience_parse_confidence"] = round(max(prev, 0.85), 2)
        meta["work_experience_source"] = "llm"
    else:
        meta["work_experience_source"] = "heuristic"
        if llm_w and l_n <= h_n:
            meta["llm_skipped_reason"] = "heuristic_has_more_or_equal_entries"

    h_s = list(out.get("studies") or [])
    s_n, l_sn = len(h_s), len(llm_s)
    if llm_s and (s_n == 0 or l_sn > s_n):
        out["studies"] = llm_s
        prev_e = out.get("education_parse_confidence")
        prev_ef = float(prev_e) if isinstance(prev_e, (int, float)) else 0.0
        out["education_parse_confidence"] = round(max(prev_ef, 0.85), 2)
        meta["studies_source"] = "llm"
    else:
        meta["studies_source"] = "heuristic"
        if llm_s and l_sn <= s_n and s_n > 0:
            meta["studies_llm_skipped_reason"] = "heuristic_has_more_or_equal_entries"

    return out


def apply_llm_work_experiences_if_configured(parsed: dict[str, Any], raw_text: str) -> dict[str, Any]:
    """Backward-compatible name; merges work and studies."""
    return apply_llm_resume_if_configured(parsed, raw_text)
