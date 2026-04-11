"""Skill name suggestions for autocomplete (DB + ESCO API + curated fallback)."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

ESCO_SEARCH_URL = "https://ec.europa.eu/esco/api/search"

# Common tech and professional skills when the database is sparse.
CURATED_SKILLS: tuple[str, ...] = (
    "Python",
    "JavaScript",
    "TypeScript",
    "Java",
    "C#",
    "C++",
    "Go",
    "Rust",
    "Ruby",
    "PHP",
    "Swift",
    "Kotlin",
    "SQL",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Django",
    "Flask",
    "FastAPI",
    "Node.js",
    "React",
    "Vue.js",
    "Angular",
    "Next.js",
    "HTML",
    "CSS",
    "Tailwind CSS",
    "REST API",
    "GraphQL",
    "Docker",
    "Kubernetes",
    "AWS",
    "Azure",
    "GCP",
    "Git",
    "CI/CD",
    "Linux",
    "Bash",
    "Terraform",
    "Machine Learning",
    "Data Analysis",
    "Excel",
    "Power BI",
    "Tableau",
    "Project Management",
    "Agile",
    "Scrum",
    "Communication",
    "Leadership",
    "Customer Service",
    "Sales",
    "Marketing",
    "SEO",
    "Content Writing",
    "UX Design",
    "UI Design",
    "Figma",
    "Adobe Creative Suite",
    "Accounting",
    "Financial Modelling",
    "Nursing",
    "Clinical Documentation",
    "Teaching",
    "Curriculum Development",
)


def _esco_hit_label(hit: dict) -> str:
    """Prefer short English labels from ESCO (en-us is usually the concise form)."""
    pl = hit.get("preferredLabel")
    if isinstance(pl, dict):
        for key in ("en-us", "en", "en-gb"):
            v = pl.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
    for key in ("title", "searchHit"):
        v = hit.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip().split("(")[0].strip()
    return ""


def _present_label(raw: str) -> str:
    s = raw.strip()
    if not s:
        return ""
    # Keep known short acronyms; otherwise title-case multi-word phrases from ESCO.
    upper = s.upper()
    if upper in {"SQL", "AWS", "GCP", "API", "CI/CD", "HTML", "CSS", "UX", "UI", "SEO"}:
        return upper if upper != "CI/CD" else "CI/CD"
    if s.isupper() and len(s) <= 6:
        return s
    return s.title() if s.islower() or s == s.lower() else s


def fetch_esco_skill_labels(query: str, *, limit: int, timeout: float) -> list[str]:
    """
    Live skill labels from the European Commission ESCO classification (third-party, no API key).
    """
    if not getattr(settings, "ESCO_SKILLS_ENABLED", True):
        return []
    q = (query or "").strip()
    if len(q) < 2:
        return []
    params = urllib.parse.urlencode(
        {
            "text": q,
            "language": "en",
            "type": "skill",
            "limit": str(max(limit, 5)),
            "full": "false",
        }
    )
    url = f"{ESCO_SEARCH_URL}?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "SkillMesh/1.0 (skill autocomplete)",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.load(resp)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError, ValueError) as exc:
        logger.debug("ESCO skill search failed: %s", exc)
        return []
    embedded = payload.get("_embedded") or {}
    results = embedded.get("results") or []
    out: list[str] = []
    for hit in results:
        if not isinstance(hit, dict):
            continue
        label = _present_label(_esco_hit_label(hit))
        if len(label) >= 2:
            out.append(label)
    return out


def suggest_skill_names(query: str, *, from_jobs: list[str], from_candidates: list[str], limit: int = 12) -> list[str]:
    q = (query or "").strip().lower()
    if len(q) < 2:
        return []

    seen: set[str] = set()
    ranked: list[str] = []

    def push(name: str) -> None:
        n = name.strip()
        if not n or len(n) < 2:
            return
        key = n.lower()
        if key in seen:
            return
        seen.add(key)
        ranked.append(n)
        if len(ranked) >= limit:
            return

    # Prefer prefix matches from DB first (jobs, then candidates).
    for source in (from_jobs, from_candidates):
        for raw in source:
            if not raw:
                continue
            n = str(raw).strip()
            nl = n.lower()
            if nl.startswith(q):
                push(n)
                if len(ranked) >= limit:
                    return ranked

    for source in (from_jobs, from_candidates):
        for raw in source:
            if not raw:
                continue
            n = str(raw).strip()
            nl = n.lower()
            if q in nl and nl not in seen:
                push(n)
                if len(ranked) >= limit:
                    return ranked

    # Third-party taxonomy (ESCO): strong coverage when DB + curated are thin.
    timeout = float(getattr(settings, "ESCO_SKILLS_TIMEOUT_SEC", 3.0))
    fetch_n = int(getattr(settings, "ESCO_SKILLS_FETCH_LIMIT", 15))
    for raw in fetch_esco_skill_labels(query, limit=min(fetch_n, max(limit * 2, 8)), timeout=timeout):
        push(str(raw).strip())
        if len(ranked) >= limit:
            return ranked

    for name in CURATED_SKILLS:
        nl = name.lower()
        if nl.startswith(q) or q in nl:
            push(name)
            if len(ranked) >= limit:
                break

    return ranked[:limit]
