import re

from candidates.models import CandidateProfile
from employers.models import JobPosting
from django.conf import settings

MIN_RECOMMENDATION_JOBS = 10
RELEVANT_SCORE_RATIO = 0.8  # keep jobs scoring ≥ 80% of the best match (then pad to MIN if needed)


def _tokenized_skills(names):
    return {n.strip().lower() for n in names if n and n.strip()}


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


def score_candidate_for_job(candidate, job, *, preferred_category_ids=None):
    """
    Heuristic 0–100+ score: skills vs job (or text fallback), education, preferred category.
    """
    if preferred_category_ids is None:
        preferred_category_ids = set(candidate.preferred_job_categories.values_list("id", flat=True))

    candidate_skills = _tokenized_skills([s.skill_name for s in candidate.skills.all()])
    job_skills = _tokenized_skills([s.skill_name for s in job.skills.all()])
    overlap = candidate_skills.intersection(job_skills)

    if job_skills:
        skill_score = (len(overlap) / max(len(job_skills), 1)) * 70.0
    else:
        # Listings without structured skills: partial credit from title/JD vs candidate skills
        blob = f"{job.title or ''} {job.jd_text or ''}"
        hits = _skill_tokens_in_text(candidate_skills, blob)
        skill_score = min(45.0, hits * 9.0) if candidate_skills else 0.0

    education_score = 30.0 if (
        not job.required_education
        or (candidate.education_level or "").lower() in job.required_education.lower()
        or job.required_education.lower() in (candidate.education_level or "").lower()
    ) else 0.0

    category_score = 0.0
    if job.job_category_id and job.job_category_id in preferred_category_ids:
        category_score = 12.0

    text_bonus = 0.0
    if settings.FEATURE_FLAGS.get("enable_text_similarity", False):
        text_bonus = 0.0

    total = round(skill_score + education_score + category_score + text_bonus, 2)
    explanation = {
        "matched_skills": sorted(overlap),
        "education_match": education_score > 0,
        "category_preference": category_score > 0,
        "skill_source": "structured" if job_skills else "text_fallback",
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
        .prefetch_related("skills", "preferred_job_categories")
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
    job = JobPosting.objects.filter(id=job_id).first()
    if not job:
        return []
    ranked = []
    for candidate in CandidateProfile.objects.all():
        score, explanation = score_candidate_for_job(candidate, job)
        ranked.append({"candidate_id": candidate.pk, "score": score, "explanation": explanation})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked[:top_n]
