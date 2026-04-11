"""
Wipe SkillMesh user data and media resumes, keep one canonical PDF, then seed
demo employer + candidate accounts with a parsed profile and sample jobs.

Usage (from backend/):

    python manage.py reset_skillmesh_dataset --yes

Requires DATABASE_URL / SUPABASE_DB_URI in .env.
"""

from __future__ import annotations

import shutil
from datetime import timezone as dt_timezone
from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from applications.models import Application
from candidates.models import (
    CandidateEducation,
    CandidateProfile,
    CandidateSkill,
    ResumeDocument,
    WorkExperience,
)
from candidates.resume_llm import apply_llm_work_experiences_if_configured
from candidates.resume_parser import extract_text_from_upload, parse_resume_text
from employers.models import CompanyProfile, JobCategory, JobPosting, JobSkill, EmployerTeamInvite
from matching.models import RecommendationLog

User = get_user_model()

CANONICAL_RESUME_NAME = "canonical_seed_resume.pdf"
DEFAULT_PASSWORD = "Airfroce02#"
CANDIDATE_EMAIL = "candidate@skillmesh.dev"
EMPLOYER_EMAIL = "employer@skillmesh.dev"


def _synthetic_resume_pdf_bytes() -> bytes:
    import fitz

    text = """Alex Morgan
Software Developer
Wollongong, NSW

Work Experience

Software Engineer | Tech Solutions Pty Ltd
Mar 2020 - Present
Building web applications using Python, Django, React, PostgreSQL, and Docker in agile teams.

Junior Developer | StartUp Co
Jan 2018 - Feb 2020
Developed REST APIs, reporting with SQL, and AWS deployments.

Education

Bachelor of Computer Science in Software Engineering
University of Technology Sydney
2014 - 2017

Skills
Python, Django, JavaScript, React, SQL, PostgreSQL, AWS, Docker, machine learning
"""
    doc = fitz.open()
    try:
        page = doc.new_page()
        y = 72
        for line in text.splitlines():
            page.insert_text((72, y), line, fontsize=11)
            y += 16
            if y > page.rect.height - 72:
                page = doc.new_page()
                y = 72
        buf = BytesIO()
        doc.save(buf)
        return buf.getvalue()
    finally:
        doc.close()


def _pick_existing_resume_bytes(resumes_dir: Path) -> bytes | None:
    if not resumes_dir.is_dir():
        return None
    pdfs = sorted(resumes_dir.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not pdfs:
        return None
    return pdfs[0].read_bytes()


def _clear_resume_media(resumes_dir: Path) -> None:
    if resumes_dir.is_dir():
        shutil.rmtree(resumes_dir)
    resumes_dir.mkdir(parents=True, exist_ok=True)


def _guess_full_name_from_text(raw_text: str, fallback: str) -> str:
    for line in (raw_text or "").splitlines():
        s = line.strip()
        if not s or len(s) > 80:
            continue
        if s.lower() in {"resume", "curriculum vitae", "cv"}:
            continue
        parts = s.split()
        if len(parts) >= 2 and not any(ch.isdigit() for ch in s):
            return s[:255]
    return fallback[:255]


def _parse_resume_dt(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        dt = value
    else:
        s = str(value).strip()
        if not s:
            return None
        dt = parse_datetime(s)
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt, dt_timezone.utc)
    return dt


def _coerce_date(value):
    if value is None:
        return None
    if hasattr(value, "year"):
        return value
    s = str(value).strip()
    if not s:
        return None
    return parse_date(s[:10])


def _apply_parsed_resume_bundle(profile: CandidateProfile, parsed: dict, raw_text: str) -> None:
    profile.full_name = _guess_full_name_from_text(raw_text, profile.full_name or profile.user.email.split("@")[0])
    profile.education_level = (profile.education_level or parsed.get("education_level") or "")[:120]
    studies = parsed.get("studies") or []
    if isinstance(studies, list) and studies:
        first = studies[0] if isinstance(studies[0], dict) else None
        if first:
            if not (profile.education_level or "").strip():
                deg = str(first.get("degree") or "").strip()
                if deg:
                    profile.education_level = deg[:120]
            if not (profile.major or "").strip():
                maj = str(first.get("major") or first.get("field_of_study") or "").strip()
                if maj:
                    profile.major = maj[:120]
    profile.headline = (profile.headline or "Open to software roles")[:180]
    profile.summary = (
        profile.summary
        or "Experienced developer with full-stack skills. Profile fields were generated from the seed resume."
    )[:2000]
    profile.location = profile.location or "Wollongong, NSW"
    profile.onboarding_step = CandidateProfile.OnboardingStep.DONE
    profile.save()

    profile.skills.all().delete()
    for skill in parsed.get("skills") or []:
        if not skill:
            continue
        CandidateSkill.objects.create(candidate=profile, skill_name=str(skill).lower()[:100], level=1)

    profile.education_entries.all().delete()
    if isinstance(studies, list):
        for row in studies:
            if not isinstance(row, dict):
                continue
            CandidateEducation.objects.create(
                candidate=profile,
                institution=str(row.get("institution") or "")[:255],
                degree=str(row.get("degree") or "")[:255],
                field_of_study=str(row.get("field_of_study") or "")[:255],
                major=str(row.get("major") or "")[:255],
                start_date=_coerce_date(row.get("start_date")),
                end_date=_coerce_date(row.get("end_date")),
                is_current=bool(row.get("is_current", False)),
                description=str(row.get("description") or "")[:1200],
                sort_order=int(row.get("sort_order", 0) or 0),
            )

    profile.work_experiences.all().delete()
    for row in parsed.get("work_experiences") or []:
        if not isinstance(row, dict):
            continue
        title = (row.get("job_title") or "").strip()
        if not title:
            continue
        WorkExperience.objects.create(
            candidate=profile,
            job_title=title[:255],
            company_name=str(row.get("company_name") or "")[:255],
            start_date=_coerce_date(row.get("start_date")),
            end_date=_coerce_date(row.get("end_date")),
            is_current=bool(row.get("is_current", False)),
            description=str(row.get("description") or "")[:1200],
            sort_order=int(row.get("sort_order", 0) or 0),
        )

    it = JobCategory.objects.filter(slug="software-it").first()
    if it:
        profile.preferred_job_categories.set([it])


def _seed_resume_row(profile: CandidateProfile, pdf_bytes: bytes) -> None:
    upload = ContentFile(pdf_bytes, name=CANONICAL_RESUME_NAME)
    raw_text = extract_text_from_upload(upload)
    upload.seek(0)
    parsed = parse_resume_text(raw_text)
    try:
        parsed = apply_llm_work_experiences_if_configured(parsed, raw_text)
    except Exception:
        pass
    resume = ResumeDocument.objects.create(
        candidate=profile,
        file=upload,
        display_name="Primary resume",
    )
    resume.raw_text = raw_text
    resume.parsed_json = parsed
    resume.parsed_at = _parse_resume_dt(parsed.get("parsed_at"))
    resume.save(update_fields=["raw_text", "parsed_json", "parsed_at"])
    _apply_parsed_resume_bundle(profile, parsed, raw_text)


class Command(BaseCommand):
    help = "Delete all users/applications/jobs/resume rows and media, then seed demo data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Required. Confirms you intend to wipe all accounts and resume files.",
        )

    def handle(self, *args, **options):
        if not options["yes"]:
            raise CommandError('Refusing to run without --yes (this deletes all users and resume media).')

        media_root = Path(settings.MEDIA_ROOT)
        resumes_dir = media_root / "resumes"
        kept_bytes = _pick_existing_resume_bytes(resumes_dir) or _synthetic_resume_pdf_bytes()

        with transaction.atomic():
            RecommendationLog.objects.all().delete()
            Application.objects.all().delete()
            EmployerTeamInvite.objects.all().delete()
            JobPosting.objects.all().delete()
            User.objects.all().delete()

        _clear_resume_media(resumes_dir)

        with transaction.atomic():
            cand = User.objects.create_user(
                email=CANDIDATE_EMAIL,
                username="candidate_demo",
                password=DEFAULT_PASSWORD,
                role=User.Role.CANDIDATE,
            )
            emp = User.objects.create_user(
                email=EMPLOYER_EMAIL,
                username="employer_demo",
                password=DEFAULT_PASSWORD,
                role=User.Role.EMPLOYER,
            )

            profile = CandidateProfile.objects.create(
                user=cand,
                full_name="Candidate User",
                education_level="",
            )
            upload_copy = ContentFile(kept_bytes, name=CANONICAL_RESUME_NAME)
            _seed_resume_row(profile, kept_bytes)

            CompanyProfile.objects.create(
                user=emp,
                company_name="SkillMesh Demo Pty Ltd",
                description="Demo employer organisation for local testing and demos.",
                location="Wollongong, NSW",
                industry="Software",
                company_size=CompanyProfile.CompanySize.R11_50,
                profile_completed=True,
            )

            it_cat = JobCategory.objects.filter(slug="software-it").first()
            data_cat = JobCategory.objects.filter(slug="data-analytics").first()

            job1 = JobPosting.objects.create(
                employer=emp,
                job_category=it_cat,
                title="Full Stack Developer",
                company_info="SkillMesh Demo Pty Ltd",
                jd_text="Join our product team to build candidate-employer matching features with Django and React.",
                whats_on_offer=["Hybrid schedule", "Learning budget", "Modern stack"],
                looking_for_people_bullets=["Care about code quality", "Collaborate with design"],
                role_bullets=["Ship API and UI features", "Improve matching quality"],
                why_choose_us_bullets=["Small team, high impact", "Based in the Illawarra region"],
                required_education="Bachelor",
                required_experience=2,
                work_mode=JobPosting.WorkMode.HYBRID,
                location="Wollongong",
                status="open",
                licenses_certifications="",
            )
            JobSkill.objects.create(job=job1, skill_name="python", weight=3)
            JobSkill.objects.create(job=job1, skill_name="react", weight=3)
            JobSkill.objects.create(job=job1, skill_name="django", weight=2)

            job2 = JobPosting.objects.create(
                employer=emp,
                job_category=data_cat or it_cat,
                title="Junior Data Analyst",
                company_info="SkillMesh Demo Pty Ltd",
                jd_text="Support reporting pipelines and dashboards; SQL and Python a plus.",
                whats_on_offer=["Mentoring", "Flexible hours"],
                looking_for_people_bullets=["Curious about data", "Clear communicator"],
                role_bullets=["Write SQL queries", "Prepare weekly metrics"],
                why_choose_us_bullets=["Growing analytics function"],
                required_education="Bachelor",
                required_experience=0,
                work_mode=JobPosting.WorkMode.REMOTE,
                location="Australia (remote)",
                status="open",
            )
            JobSkill.objects.create(job=job2, skill_name="sql", weight=3)
            JobSkill.objects.create(job=job2, skill_name="python", weight=2)

            resume_doc = ResumeDocument.objects.filter(candidate=profile).order_by("-created_at").first()
            if resume_doc:
                Application.objects.create(
                    candidate=cand,
                    job=job1,
                    resume=resume_doc,
                    cover_letter_mode=Application.CoverLetterMode.IN_APP,
                    cover_letter_text=(
                        "Hello — I am interested in this Full Stack Developer role and would love to contribute "
                        "to SkillMesh's matching experience."
                    ),
                )

        self.stdout.write(self.style.SUCCESS("Reset complete."))
        self.stdout.write(f"  Candidate login: {CANDIDATE_EMAIL}")
        self.stdout.write(f"  Employer login:  {EMPLOYER_EMAIL}")
        self.stdout.write(f"  Password (both): {DEFAULT_PASSWORD}")
        rd = ResumeDocument.objects.first()
        if rd and rd.file:
            self.stdout.write(f"  Stored resume file: {rd.file.path}")
