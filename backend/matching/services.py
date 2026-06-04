import re
from datetime import date

from candidates.models import CandidateProfile
from employers.models import JobPosting

MIN_RECOMMENDATION_JOBS = 10
RELEVANT_SCORE_RATIO = 0.8  # keep jobs scoring ≥ 80% of the best match (then pad to MIN if needed)

_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "with",
        "will",
        "you",
        "your",
        "our",
        "we",
        "their",
        "they",
        "role",
        "position",
        "team",
        "work",
        "job",
    }
)


def _tokenized_skills(names):
    return {n.strip().lower() for n in names if n and n.strip()}


def _meaningful_tokens(text, *, min_len=3):
    if not text:
        return set()
    blob = re.sub(r"[^\w\s]+", " ", text.lower())
    return {t for t in blob.split() if len(t) >= min_len and t not in _STOPWORDS}


def _jaccard_score(tokens_a, tokens_b, *, cap):
    if not tokens_a or not tokens_b:
        return 0.0
    inter = tokens_a.intersection(tokens_b)
    if not inter:
        return 0.0
    union = tokens_a.union(tokens_b)
    return min(cap, cap * (len(inter) / max(len(union), 1)))


def _skill_tokens_in_text(skill_tokens, text):
    """Rough overlap: candidate skill tokens found as substrings in job text."""
    if not text or not skill_tokens:
        return 0
    blob = re.sub(r"[^\w\s]+", " ", text.lower())
    n = 0
    for s in skill_tokens:
        if len(s) < 2:
            continue
        if s in blob:
            n += 1
    return n


def _experience_years(candidate):
    today = date.today()
    years = 0.0
    for row in candidate.work_experiences.all():
        if not row.start_date:
            continue
        end = today if row.is_current or not row.end_date else row.end_date
        if end < row.start_date:
            continue
        years += (end - row.start_date).days / 365.25
    return max(0.0, round(years, 2))


def _experience_text_blob(candidate):
    bits = []
    for row in candidate.work_experiences.all():
        bits.extend([row.job_title or "", row.company_name or "", row.description or ""])
    return " ".join(b for b in bits if b).lower()


def _work_title_tokens(candidate):
    tokens = set()
    for row in candidate.work_experiences.all():
        tokens.update(_meaningful_tokens(row.job_title or "", min_len=3))
    return tokens


def _education_text_blob(candidate):
    bits = [candidate.education_level or "", candidate.major or ""]
    for row in candidate.education_entries.all():
        bits.extend([row.degree or "", row.field_of_study or "", row.major or "", row.description or ""])
    return " ".join(b for b in bits if b).lower()


def _profile_text_blob(candidate):
    bits = [
        candidate.headline or "",
        candidate.summary or "",
        candidate.major or "",
        candidate.education_level or "",
        candidate.location or "",
    ]
    return " ".join(b for b in bits if b).lower()


def _candidate_document_tokens(candidate):
    parts = [
        _profile_text_blob(candidate),
        _experience_text_blob(candidate),
        _education_text_blob(candidate),
        " ".join(s.skill_name for s in candidate.skills.all()),
    ]
    return _meaningful_tokens(" ".join(parts))


def _job_document_tokens(job):
    parts = [
        job.title or "",
        job.jd_text or "",
        job.location or "",
        job.required_education or "",
        " ".join(s.skill_name for s in job.skills.all()),
    ]
    if job.job_category_id and getattr(job, "job_category", None):
        parts.append(job.job_category.name or "")
    return _meaningful_tokens(" ".join(parts))


def _skill_overlap_score(candidate, job, candidate_skills, job_skills, overlap):
    if job_skills:
        base = (len(overlap) / max(len(job_skills), 1)) * 48.0
        cand_levels = {s.skill_name.lower(): s.level for s in candidate.skills.all()}
        job_weights = {s.skill_name.lower(): s.weight for s in job.skills.all()}
        if overlap:
            boosts = [min(cand_levels.get(sk, 1), job_weights.get(sk, 1)) for sk in overlap]
            base += (sum(boosts) / len(boosts)) / 3.0 * 7.0
        return base, "structured"
    blob = f"{job.title or ''} {job.jd_text or ''}"
    hits = _skill_tokens_in_text(candidate_skills, blob)
    return (min(32.0, hits * 7.0) if candidate_skills else 0.0), "text_fallback"


def _location_score(candidate, job):
    job_loc = (job.location or "").strip().lower()
    if not job_loc:
        return 0.0, False
    cand_parts = [
        (candidate.location or "").strip().lower(),
        (candidate.postcode or "").strip().lower(),
        (candidate.country or "").strip().lower(),
    ]
    for part in cand_parts:
        if len(part) < 2:
            continue
        if part in job_loc or job_loc in part:
            return 10.0, True
    job_tokens = _meaningful_tokens(job_loc, min_len=3)
    for part in cand_parts:
        if job_tokens.intersection(_meaningful_tokens(part, min_len=3)):
            return 6.0, True
    return 0.0, False


def _title_role_score(candidate, job):
    job_title_tokens = _meaningful_tokens(job.title or "", min_len=3)
    if not job_title_tokens:
        return 0.0, 0
    work_titles = _work_title_tokens(candidate)
    hits = len(job_title_tokens.intersection(work_titles))
    if hits <= 0:
        return 0.0, 0
    return min(10.0, float(hits) * 3.5), hits


def score_candidate_for_job(candidate, job, *, preferred_category_ids=None):
    """
    Heuristic multi-signal score for candidate/job alignment.
    Uses skills (with levels/weights), education, categories, work mode, experience
    years, work-history text, profile text, location, and document token overlap.
    """
    if preferred_category_ids is None:
        preferred_category_ids = set(candidate.preferred_job_categories.values_list("id", flat=True))

    candidate_skills = _tokenized_skills([s.skill_name for s in candidate.skills.all()])
    job_skills = _tokenized_skills([s.skill_name for s in job.skills.all()])
    overlap = candidate_skills.intersection(job_skills)

    skill_score, skill_source = _skill_overlap_score(
        candidate, job, candidate_skills, job_skills, overlap
    )

    edu_blob = _education_text_blob(candidate)
    req_education = (job.required_education or "").lower()
    education_score = 0.0
    if not req_education:
        education_score = 8.0
    elif req_education in edu_blob or any(t in edu_blob for t in req_education.split() if len(t) > 3):
        education_score = 18.0

    category_score = 12.0 if job.job_category_id and job.job_category_id in preferred_category_ids else 0.0

    mode_score = 0.0
    preferred_mode = (candidate.preferred_mode or "").strip().lower()
    if preferred_mode and preferred_mode == (job.work_mode or "").strip().lower():
        mode_score = 10.0

    experience_score = 0.0
    required_years = float(job.required_experience or 0)
    candidate_years = _experience_years(candidate)
    if required_years <= 0:
        experience_score = 6.0
    elif candidate_years >= required_years:
        experience_score = 14.0
    else:
        experience_score = max(0.0, (candidate_years / required_years) * 14.0)

    relevance_blob = f"{job.title or ''} {job.jd_text or ''}".lower()
    exp_blob = _experience_text_blob(candidate)
    experience_text_hits = 0
    for token in _meaningful_tokens(relevance_blob, min_len=5):
        if token in exp_blob:
            experience_text_hits += 1
    experience_text_bonus = min(8.0, float(experience_text_hits) * 1.5)

    location_score, location_match = _location_score(candidate, job)
    title_score, title_hits = _title_role_score(candidate, job)

    profile_tokens = _meaningful_tokens(_profile_text_blob(candidate))
    job_relevance_tokens = _meaningful_tokens(relevance_blob)
    profile_text_bonus = _jaccard_score(profile_tokens, job_relevance_tokens, cap=8.0)

    document_overlap = _jaccard_score(
        _candidate_document_tokens(candidate),
        _job_document_tokens(job),
        cap=10.0,
    )

    total = round(
        skill_score
        + education_score
        + category_score
        + mode_score
        + experience_score
        + experience_text_bonus
        + location_score
        + title_score
        + profile_text_bonus
        + document_overlap,
        2,
    )
    explanation = {
        "matched_skills": sorted(overlap),
        "education_match": education_score >= 18.0,
        "category_preference": category_score > 0,
        "work_mode_match": mode_score > 0,
        "location_match": location_match,
        "title_role_hits": title_hits,
        "experience_years": candidate_years,
        "required_experience_years": required_years,
        "experience_text_hits": experience_text_hits,
        "profile_text_overlap": round(profile_text_bonus, 2),
        "document_overlap": round(document_overlap, 2),
        "skill_source": skill_source,
    }
    return total, explanation


def _recommendation_list_for_api(ranked):
    """
    Jobs scoring at least RELEVANT_SCORE_RATIO × best score, plus padding so the
    candidate always sees at least MIN_RECOMMENDATION_JOBS when that many exist.
    """
    if not ranked:
        return []
    best = ranked[0]["score"]
    if best <= 0:
        return ranked[:MIN_RECOMMENDATION_JOBS]
    floor = best * RELEVANT_SCORE_RATIO
    strong = [r for r in ranked if r["score"] >= floor]
    if len(strong) >= MIN_RECOMMENDATION_JOBS:
        return strong
    seen = {r["job_id"] for r in strong}
    out = list(strong)
    for r in ranked:
        if r["job_id"] in seen:
            continue
        out.append(r)
        seen.add(r["job_id"])
        if len(out) >= MIN_RECOMMENDATION_JOBS:
            break
    return out


def recommend_jobs_for_candidate(candidate_user, top_k=None):
    """
    Rank open jobs by profile match. API default: relevance filter (≥80% of best score)
    with at least MIN_RECOMMENDATION_JOBS listings when possible.
    Pass top_k for a hard cap (e.g. unit tests).
    """
    candidate = (
        CandidateProfile.objects.filter(user=candidate_user)
        .prefetch_related("skills", "preferred_job_categories", "work_experiences", "education_entries")
        .first()
    )
    if not candidate:
        return []
    pref_ids = set(candidate.preferred_job_categories.values_list("id", flat=True))
    ranked = []
    qs = JobPosting.objects.public_live().select_related("job_category").prefetch_related("skills")
    for job in qs:
        score, explanation = score_candidate_for_job(candidate, job, preferred_category_ids=pref_ids)
        ranked.append({"job_id": job.id, "score": score, "explanation": explanation})
    ranked.sort(key=lambda x: (x["score"], x["job_id"]), reverse=True)
    if top_k is not None:
        return ranked[: int(top_k)]
    return _recommendation_list_for_api(ranked)


def recommend_candidates_for_job(job_id, top_n=10):
    job = JobPosting.objects.filter(id=job_id).select_related("job_category").prefetch_related("skills").first()
    if not job:
        return []
    ranked = []
    for candidate in CandidateProfile.objects.prefetch_related(
        "skills", "work_experiences", "education_entries", "preferred_job_categories"
    ):
        score, explanation = score_candidate_for_job(candidate, job)
        ranked.append(
            {
                "candidate_id": candidate.pk,
                "full_name": candidate.full_name,
                "headline": candidate.headline or "",
                "score": score,
                "explanation": explanation,
            }
        )
    ranked.sort(key=lambda x: x["score"], reverse=True)
    if top_n is None:
        return ranked
    return ranked[:top_n]
