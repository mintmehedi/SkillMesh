from candidates.models import CandidateProfile
from employers.models import JobPosting
from django.conf import settings


def _tokenized_skills(names):
    return {n.strip().lower() for n in names if n and n.strip()}


def score_candidate_for_job(candidate, job):
    candidate_skills = _tokenized_skills([s.skill_name for s in candidate.skills.all()])
    job_skills = _tokenized_skills([s.skill_name for s in job.skills.all()])
    overlap = candidate_skills.intersection(job_skills)
    skill_score = (len(overlap) / max(len(job_skills), 1)) * 60.0

    exp_gap = abs(candidate.years_experience - job.required_experience)
    experience_score = max(0.0, 25.0 - (exp_gap * 5.0))

    education_score = 15.0 if (
        not job.required_education
        or candidate.education_level.lower() in job.required_education.lower()
        or job.required_education.lower() in candidate.education_level.lower()
    ) else 0.0

    text_bonus = 0.0
    if settings.FEATURE_FLAGS.get("enable_text_similarity", False):
        # Safe placeholder for Week-8 change; keeps API stable when enabled later.
        text_bonus = 0.0

    total = round(skill_score + experience_score + education_score + text_bonus, 2)
    explanation = {
        "matched_skills": sorted(overlap),
        "experience_gap": exp_gap,
        "education_match": education_score > 0,
    }
    return total, explanation


def recommend_jobs_for_candidate(candidate_user, top_k=10):
    candidate = CandidateProfile.objects.filter(user=candidate_user).first()
    if not candidate:
        return []
    ranked = []
    for job in JobPosting.objects.filter(status="open").all():
        score, explanation = score_candidate_for_job(candidate, job)
        ranked.append({"job_id": job.id, "score": score, "explanation": explanation})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked[:top_k]


def recommend_candidates_for_job(job_id, top_n=10):
    job = JobPosting.objects.filter(id=job_id).first()
    if not job:
        return []
    ranked = []
    for candidate in CandidateProfile.objects.all():
        score, explanation = score_candidate_for_job(candidate, job)
        ranked.append({"candidate_id": candidate.id, "score": score, "explanation": explanation})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return ranked[:top_n]
