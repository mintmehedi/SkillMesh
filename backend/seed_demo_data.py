import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mysite.settings")

import django  # noqa: E402

django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from candidates.models import CandidateProfile, CandidateSkill  # noqa: E402
from employers.models import JobCategory, JobPosting, JobSkill  # noqa: E402

User = get_user_model()


def run():
    candidate_user, _ = User.objects.get_or_create(
        email="candidate@skillmesh.dev",
        defaults={"username": "candidate_demo", "role": "candidate"},
    )
    candidate_user.set_password("Password123!")
    candidate_user.save()

    employer_user, _ = User.objects.get_or_create(
        email="employer@skillmesh.dev",
        defaults={"username": "employer_demo", "role": "employer"},
    )
    employer_user.set_password("Password123!")
    employer_user.save()

    profile, _ = CandidateProfile.objects.get_or_create(
        user=candidate_user,
        defaults={"full_name": "Demo Candidate", "education_level": "Bachelor", "years_experience": 2},
    )
    CandidateSkill.objects.get_or_create(candidate=profile, skill_name="python", defaults={"level": 3})
    CandidateSkill.objects.get_or_create(candidate=profile, skill_name="react", defaults={"level": 2})

    it_cat = JobCategory.objects.filter(slug="software-it").first()

    job, _ = JobPosting.objects.get_or_create(
        employer=employer_user,
        title="Junior Full Stack Developer",
        defaults={
            "jd_text": "Need python, django and react experience",
            "required_education": "Bachelor",
            "required_experience": 1,
            "work_mode": "hybrid",
            "location": "Wollongong",
            "status": "open",
            "job_category": it_cat,
        },
    )
    JobSkill.objects.get_or_create(job=job, skill_name="python", defaults={"weight": 3})
    JobSkill.objects.get_or_create(job=job, skill_name="react", defaults={"weight": 2})
    if it_cat and job.job_category_id is None:
        job.job_category = it_cat
        job.save(update_fields=["job_category"])
    print("Seeded demo users/data.")


if __name__ == "__main__":
    run()
