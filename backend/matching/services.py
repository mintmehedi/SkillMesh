import re
from datetime import date

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


def _education_text_blob(candidate):
    bits = [candidate.education_level or "", candidate.major or ""]
    for row in candidate.education_entries.all():
        bits.extend([row.degree or "", row.field_of_study or "", row.major or "", row.description or ""])
    return " ".join(b for b in bits if b).lower()


def score_candidate_for_job(candidate, job, *, preferred_category_ids=None):
    """
    Heuristic multi-signal score for candidate/job alignment.
    """
    if preferred_category_ids is None:
        preferred_category_ids = set(candidate.preferred_job_categories.values_list("id", flat=True))

    candidate_skills = _tokenized_skills([s.skill_name for s in candidate.skills.all()])
    job_skills = _tokenized_skills([s.skill_name for s in job.skills.all()])
    overlap = candidate_skills.intersection(job_skills)

    if job_skills:
        skill_score = (len(overlap) / max(len(job_skills), 1)) * 50.0
    else:
        # Listings without structured skills: partial credit from title/JD vs candidate skills
        blob = f"{job.title or ''} {job.jd_text or ''}"
        hits = _skill_tokens_in_text(candidate_skills, blob)
        skill_score = min(35.0, hits * 7.0) if candidate_skills else 0.0

    edu_blob = _education_text_blob(candidate)
    req_education = (job.required_education or "").lower()
    education_score = 0.0
    if not req_education:
        education_score = 8.0
    elif req_education in edu_blob or any(t in edu_blob for t in req_education.split() if len(t) > 3):
        education_score = 20.0

    category_score = 0.0
    if job.job_category_id and job.job_category_id in preferred_category_ids:
        category_score = 12.0

    mode_score = 0.0
    preferred_mode = (candidate.preferred_mode or "").strip().lower()
    if preferred_mode and preferred_mode == (job.work_mode or "").strip().lower():
        mode_score = 12.0

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
    for token in {t for t in re.findall(r"\w+", relevance_blob) if len(t) > 4}:
        if token in exp_blob:
            experience_text_hits += 1
    experience_text_bonus = min(8.0, float(experience_text_hits))

    text_bonus = 0.0
    if settings.FEATURE_FLAGS.get("enable_text_similarity", False):
        text_bonus = 0.0

    total = round(
        skill_score
        + education_score
        + category_score
        + mode_score
        + experience_score
        + experience_text_bonus
        + text_bonus,
        2,
    )
    explanation = {
        "matched_skills": sorted(overlap),
        "education_match": education_score > 0,
        "category_preference": category_score > 0,
        "work_mode_match": mode_score > 0,
        "experience_years": candidate_years,
        "required_experience_years": required_years,
        "experience_text_hits": experience_text_hits,
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
    job = JobPosting.objects.filter(id=job_id).first()
    if not job:
        return []
    ranked = []
    for candidate in CandidateProfile.objects.all():
        score, explanation = score_candidate_for_job(candidate, job)
        ranked.append({"candidate_id": candidate.pk, "score": score, "explanation": explanation})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked[:top_n]
