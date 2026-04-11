"""
Wipe SkillMesh user-generated data, then seed:
  - 10 employer accounts (each with company profile)
  - 100 job postings (10 per employer), spread across job categories
  - 20 candidate accounts with varied profiles (skills, education, experience)

Usage (from backend/):

    python manage.py seed_bulk_demo --yes

Password for every seeded account: Airfroce02#
Employer emails: employer01@skillmesh.dev … employer10@skillmesh.dev
Candidate emails: candidate01@skillmesh.dev … candidate20@skillmesh.dev
"""

from __future__ import annotations

import shutil
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from applications.models import Application
from candidates.models import (
    CandidateEducation,
    CandidateProfile,
    CandidateSkill,
    WorkExperience,
)
from employers.models import CompanyProfile, JobCategory, JobPosting, JobSkill, EmployerTeamInvite
from matching.models import RecommendationLog

User = get_user_model()

DEFAULT_PASSWORD = "Airfroce02#"
NUM_EMPLOYERS = 10
JOBS_PER_EMPLOYER = 10
NUM_CANDIDATES = 20

# (company_name, industry, location_line, city, country, size, description snippet)
COMPANY_ROWS: list[tuple[str, str, str, str, str, str, str]] = [
    ("Harbour City Analytics Pty Ltd", "Data & analytics", "Sydney CBD, NSW", "Sydney", "Australia", CompanyProfile.CompanySize.R11_50, "Insights, forecasting, and BI for enterprise clients."),
    ("Illawarra Care Collective", "Healthcare", "Wollongong & Shellharbour", "Wollongong", "Australia", CompanyProfile.CompanySize.R51_200, "Community clinics, allied health, and aged-care programs."),
    ("Southern Star Retail Group", "Retail", "Greater Melbourne", "Melbourne", "Australia", CompanyProfile.CompanySize.R201_500, "Fashion, homewares, and omnichannel fulfilment."),
    ("BlueScope Digital Works", "Manufacturing & technology", "Port Kembla / hybrid", "Wollongong", "Australia", CompanyProfile.CompanySize.R501_1000, "Industrial software, IoT telemetry, and plant systems."),
    ("BrightPath Education Services", "Education", "NSW South Coast", "Nowra", "Australia", CompanyProfile.CompanySize.R11_50, "VET pathways, student support, and campus operations."),
    ("Summit Finance Partners", "Finance", "Parramatta, NSW", "Parramatta", "Australia", CompanyProfile.CompanySize.R51_200, "SMSF, lending operations, and compliance advisory."),
    ("Coastal Marketing Studio", "Marketing", "Byron Bay & remote", "Byron Bay", "Australia", CompanyProfile.CompanySize.R1_10, "Brand campaigns, performance ads, and content studios."),
    ("Greenfield Construction Co", "Construction", "Illawarra region", "Kiama", "Australia", CompanyProfile.CompanySize.R11_50, "Civil works, residential builds, and site safety."),
    ("Atlas HR Advisory", "Human resources", "Canberra & Sydney", "Canberra", "Australia", CompanyProfile.CompanySize.R11_50, "Workplace relations, payroll transitions, and policy design."),
    ("Pacific Media Labs", "Media", "Surfers Paradise, QLD", "Gold Coast", "Australia", CompanyProfile.CompanySize.R11_50, "Streaming ops, post-production, and ad trafficking."),
]

# slug -> preferred skills for postings (2–4 used per job)
SLUG_SKILLS: dict[str, list[str]] = {
    "software-it": ["python", "javascript", "react", "django", "aws", "docker", "sql", "git"],
    "data-analytics": ["sql", "python", "tableau", "excel", "r", "power bi", "etl", "statistics"],
    "healthcare": ["patient care", "clinical documentation", "emr", "infection control", "first aid", "teamwork"],
    "finance": ["excel", "financial modelling", "xero", "compliance", "reporting", "payroll"],
    "education": ["curriculum design", "student engagement", "assessment", "lms", "safeguarding", "communication"],
    "marketing": ["seo", "google ads", "copywriting", "social media", "crm", "analytics"],
    "sales": ["crm", "negotiation", "pipeline management", "presentations", "b2b sales", "customer success"],
    "engineering": ["cad", "project scheduling", "site inspection", "hse", "quality assurance", "autocad"],
    "design": ["figma", "ui design", "brand systems", "prototyping", "accessibility", "illustration"],
    "hr": ["recruitment", "policy", "payroll systems", "employee relations", "onboarding", "hris"],
    "operations": ["inventory", "logistics", "procurement", "lean", "scheduling", "vendor management"],
    "legal": ["legal research", "contracts", "compliance", "due diligence", "documentation", "litigation support"],
    "government-public": ["policy", "stakeholder engagement", "grant reporting", "records management", "risk"],
    "trades-construction": ["carpentry", "electrical", "workplace safety", "blueprint reading", "tools"],
    "hospitality-tourism": ["customer service", "pos systems", "food safety", "event setup", "reservations"],
    "retail-customer-service": ["pos", "visual merchandising", "stock control", "customer complaints", "sales"],
    "science-rd": ["laboratory techniques", "data collection", "literature review", "python", "technical writing"],
    "agriculture": ["machinery operation", "soil sampling", "sustainability reporting", "gps mapping", "ohs"],
    "media-entertainment": ["video editing", "audio mixing", "davinci resolve", "production scheduling", "rights"],
    "nonprofit": ["fundraising", "volunteer coordination", "community outreach", "grant writing", "events"],
    "consulting": ["stakeholder workshops", "slide decks", "facilitation", "research", "excel"],
    "real-estate": ["property inspections", "crm", "leasing", "negotiation", "compliance forms"],
    "customer-support": ["ticketing systems", "zendesk", "troubleshooting", "documentation", "empathy"],
    "product-management": ["roadmapping", "user research", "jira", "metrics", "prioritisation"],
}

WORK_MODES = [
    JobPosting.WorkMode.HYBRID,
    JobPosting.WorkMode.REMOTE,
    JobPosting.WorkMode.ONSITE,
]

COMP_PERIODS = [
    JobPosting.CompensationPeriod.YEARLY,
    JobPosting.CompensationPeriod.HOURLY,
    JobPosting.CompensationPeriod.MONTHLY,
    JobPosting.CompensationPeriod.NOT_SPECIFIED,
]


def _clear_resume_media(resumes_dir: Path) -> None:
    if resumes_dir.is_dir():
        shutil.rmtree(resumes_dir)
    resumes_dir.mkdir(parents=True, exist_ok=True)


def _skills_for_slug(slug: str, job_index: int) -> list[tuple[str, int]]:
    pool = SLUG_SKILLS.get(slug) or ["communication", "teamwork", "microsoft office", "organisation"]
    n = 2 + (job_index % 3)
    out: list[tuple[str, int]] = []
    for k in range(n):
        name = pool[(job_index + k) % len(pool)]
        weight = 1 + ((job_index + k) % 3)
        out.append((name, weight))
    return out


def _candidate_personas() -> list[dict]:
    """Twenty distinct synthetic personas (names, locations, study, work, skills)."""
    return [
        {"name": "Aisha Khan", "city": "Sydney", "headline": "Backend engineer · APIs & data", "edu": "Master", "major": "Computer Science", "summary": "Five years shipping services on AWS; interested in health-tech.", "skills": [("python", 4), ("postgresql", 4), ("aws", 3), ("docker", 3)], "work": [("Software Engineer", "Northwind Labs", "API design and migrations."), ("Developer", "Campus IT", "Student systems and SSO.")], "school": ("UNSW", "MSc Information Technology", "Software systems")},
        {"name": "Ben O'Connor", "city": "Wollongong", "headline": "Civil site engineer", "edu": "Bachelor", "major": "Civil Engineering", "summary": "Site supervision, drainage packages, and contractor coordination.", "skills": [("autocad", 4), ("project scheduling", 3), ("hse", 4), ("quality assurance", 2)], "work": [("Graduate Engineer", "Harbour Civils", "Roadworks and stormwater as-built checks.")], "school": ("University of Wollongong", "BEng (Civil)", "Structural mechanics")},
        {"name": "Chen Wei", "city": "Melbourne", "headline": "Data analyst · reporting", "edu": "Bachelor", "major": "Statistics", "summary": "Dashboards in Power BI; SQL for finance and ops stakeholders.", "skills": [("sql", 4), ("power bi", 4), ("excel", 5), ("python", 2)], "work": [("Reporting Analyst", "Summit Finance Partners", "Month-end packs and variance commentary.")], "school": ("Monash University", "BSc Statistics", "Applied regression")},
        {"name": "Dana Morales", "city": "Brisbane", "headline": "Registered nurse · acute care", "edu": "Bachelor", "major": "Nursing", "summary": "Ward rotations; strong documentation and patient advocacy.", "skills": [("patient care", 5), ("clinical documentation", 4), ("emr", 3), ("infection control", 4)], "work": [("RN", "Metro General", "Medical ward; admissions and discharge planning.")], "school": ("QUT", "BNursing", "Acute care")},
        {"name": "Ethan Price", "city": "Canberra", "headline": "Policy officer", "edu": "Master", "major": "Public Policy", "summary": "Briefs, cabinet submissions, and stakeholder workshops.", "skills": [("policy", 4), ("stakeholder engagement", 4), ("grant reporting", 3), ("risk", 2)], "work": [("Graduate APS", "Department placeholder", "Program reporting and FoI prep.")], "school": ("ANU", "MPP", "Governance")},
        {"name": "Fatima Noor", "city": "Perth", "headline": "HR coordinator", "edu": "Bachelor", "major": "Human Resources", "summary": "Onboarding, contracts, and HRIS clean-up projects.", "skills": [("onboarding", 4), ("hris", 3), ("employee relations", 3), ("payroll systems", 2)], "work": [("HR Coordinator", "Atlas HR Advisory", "Policy updates and induction packs.")], "school": ("Curtin University", "BHRM", "IR law")},
        {"name": "George Papadopoulos", "city": "Adelaide", "headline": "Electrician · commercial fit-outs", "edu": "Certificate", "major": "Electrotechnology", "summary": "Test & tag, switchboards, and site compliance.", "skills": [("electrical", 5), ("workplace safety", 4), ("blueprint reading", 3)], "work": [("Licensed Electrician", "Greenfield Construction Co", "Retail fit-outs and defect lists.")], "school": ("TAFE SA", "Cert III Electrotechnology", "Installation rules")},
        {"name": "Hannah Lee", "city": "Gold Coast", "headline": "Video editor", "edu": "Diploma", "major": "Screen & Media", "summary": "Short-form social, colour, and simple motion.", "skills": [("video editing", 4), ("davinci resolve", 4), ("audio mixing", 2), ("production scheduling", 3)], "work": [("Junior Editor", "Pacific Media Labs", "YouTube series and ad cutdowns.")], "school": ("SAE Institute", "Diploma Post Production", "Editing craft")},
        {"name": "Ibrahim Said", "city": "Darwin", "headline": "Logistics coordinator", "edu": "Bachelor", "major": "Supply Chain", "summary": "Imports, 3PL bookings, and warehouse KPI tracking.", "skills": [("logistics", 4), ("inventory", 4), ("procurement", 3), ("scheduling", 3)], "work": [("Coordinator", "Northern Freight Hub", "Cross-dock scheduling and claims.")], "school": ("CDU", "BCommerce (Logistics)", "Operations")},
        {"name": "Julia Nguyen", "city": "Hobart", "headline": "Environmental field tech", "edu": "Bachelor", "major": "Environmental Science", "summary": "Field sampling, chain of custody, and basic GIS.", "skills": [("soil sampling", 4), ("gps mapping", 3), ("sustainability reporting", 3), ("ohs", 3)], "work": [("Field Technician", "TasEnviro Survey", "Water quality monitoring campaigns.")], "school": ("University of Tasmania", "BSc Environmental Science", "Ecology")},
        {"name": "Kevin Brooks", "city": "Newcastle", "headline": "Sales development rep", "edu": "Bachelor", "major": "Business", "summary": "Outbound sequences, CRM hygiene, and discovery calls.", "skills": [("b2b sales", 3), ("crm", 4), ("pipeline management", 3), ("presentations", 2)], "work": [("SDR", "Southern Star Retail Group", "Corporate gifting pilot outreach.")], "school": ("University of Newcastle", "BCommerce", "Marketing")},
        {"name": "Laura Schmidt", "city": "Sydney", "headline": "UX / UI designer", "edu": "Bachelor", "major": "Interaction Design", "summary": "Design systems, research synthesis, and accessible components.", "skills": [("figma", 5), ("ui design", 4), ("user research", 3), ("accessibility", 3)], "work": [("Product Designer", "Coastal Marketing Studio", "Landing pages and component library.")], "school": ("UTS", "BDesign", "Human-centred design")},
        {"name": "Marcus Jones", "city": "Melbourne", "headline": "Financial accountant", "edu": "Bachelor", "major": "Accounting", "summary": "Month-end close, intercompany, and audit support.", "skills": [("financial modelling", 3), ("xero", 3), ("reporting", 4), ("compliance", 3)], "work": [("Accountant", "Summit Finance Partners", "Consolidations and tax packs.")], "school": ("RMIT", "BBus Accounting", "Corporate accounting")},
        {"name": "Nina Patel", "city": "Wollongong", "headline": "Primary teacher", "edu": "Bachelor", "major": "Education", "summary": "Differentiated literacy; parent communication.", "skills": [("curriculum design", 4), ("student engagement", 5), ("assessment", 4), ("communication", 4)], "work": [("Classroom Teacher", "Illawarra Public School", "Stage 2 literacy and STEM club.")], "school": ("UOW", "BPrimary Education", "Pedagogy")},
        {"name": "Oscar Ramirez", "city": "Cairns", "headline": "Hotel duty manager", "edu": "Diploma", "major": "Hospitality Management", "summary": "Rosters, guest recovery, and event floor runs.", "skills": [("customer service", 5), ("food safety", 4), ("reservations", 3), ("event setup", 3)], "work": [("Duty Manager", "Reefside Resort", "Night audit and VIP arrivals.")], "school": ("James Cook University", "Dip Hospitality", "Operations")},
        {"name": "Priya Desai", "city": "Sydney", "headline": "Product manager · B2B SaaS", "edu": "Master", "major": "Information Systems", "summary": "Discovery, roadmap trade-offs, and launch playbooks.", "skills": [("roadmapping", 4), ("jira", 3), ("user research", 4), ("metrics", 3)], "work": [("Associate PM", "Harbour City Analytics", "Internal analytics product for clients.")], "school": ("USyd", "MIS", "Digital innovation")},
        {"name": "Quinn Taylor", "city": "Melbourne", "headline": "Customer support lead", "edu": "Certificate", "major": "IT support", "summary": "Escalations, macros, and coaching a small team.", "skills": [("zendesk", 4), ("troubleshooting", 4), ("documentation", 3), ("empathy", 5)], "work": [("Support Lead", "Southern Star Retail Group", "Omni-channel helpdesk.")], "school": ("TAFE Victoria", "Cert IV IT", "Networks")},
        {"name": "Rachel Okafor", "city": "Canberra", "headline": "Research assistant · life sciences", "edu": "Bachelor", "major": "Biotechnology", "summary": "Assays, lab notebooks, and ethics applications.", "skills": [("laboratory techniques", 4), ("data collection", 3), ("technical writing", 3), ("literature review", 3)], "work": [("RA", "National Bio Institute", "Cell culture support.")], "school": ("ANU", "BBiotech", "Molecular biology")},
        {"name": "Sam Wilson", "city": "Wollongong", "headline": "DevOps / platform", "edu": "Bachelor", "major": "Computer Science", "summary": "Kubernetes, CI/CD, and observability for steel-adjacent workloads.", "skills": [("kubernetes", 3), ("docker", 4), ("git", 4), ("aws", 3)], "work": [("Platform Engineer", "BlueScope Digital Works", "Pipelines and on-call rotations.")], "school": ("UOW", "BCompSci", "Systems")},
        {"name": "Tara Murphy", "city": "Byron Bay", "headline": "Fundraising coordinator · nonprofit", "edu": "Bachelor", "major": "Community Development", "summary": "Donor stewardship, events, and volunteer rosters.", "skills": [("fundraising", 4), ("events", 3), ("grant writing", 3), ("volunteer coordination", 4)], "work": [("Coordinator", "Coastal Youth Initiative", "Annual appeal and partnerships.")], "school": ("SCU", "BCommunity Welfare", "Social impact")},
    ]


def _category_preferences_for_index(i: int, categories: list[JobCategory]) -> list[JobCategory]:
    if not categories:
        return []
    n = 1 + (i % 3)
    return [categories[(i + k) % len(categories)] for k in range(n)]


class Command(BaseCommand):
    help = "Wipe users/jobs/applications and seed 10 employers (100 jobs) + 20 candidates."

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Required. Confirms destructive wipe of all users, jobs, applications, invites.",
        )

    def handle(self, *args, **options):
        if not options["yes"]:
            raise CommandError("Refusing to run without --yes.")

        media_root = Path(settings.MEDIA_ROOT)
        resumes_dir = media_root / "resumes"

        with transaction.atomic():
            RecommendationLog.objects.all().delete()
            Application.objects.all().delete()
            EmployerTeamInvite.objects.all().delete()
            JobPosting.objects.all().delete()
            User.objects.all().delete()

        _clear_resume_media(resumes_dir)

        categories = list(JobCategory.objects.order_by("sort_order", "slug"))
        if not categories:
            raise CommandError("No JobCategory rows in DB; run migrations.")

        personas = _candidate_personas()
        if len(personas) != NUM_CANDIDATES:
            raise CommandError(f"Internal error: expected {NUM_CANDIDATES} personas, got {len(personas)}")

        with transaction.atomic():
            employers: list[User] = []
            for e in range(NUM_EMPLOYERS):
                row = COMPANY_ROWS[e]
                name, industry, loc_line, city, country, size, desc_snip = row
                u = User.objects.create_user(
                    email=f"employer{e + 1:02d}@skillmesh.dev",
                    username=f"employer{e + 1:02d}",
                    password=DEFAULT_PASSWORD,
                    role=User.Role.EMPLOYER,
                )
                employers.append(u)
                CompanyProfile.objects.create(
                    user=u,
                    company_name=name,
                    description=desc_snip,
                    location=loc_line,
                    industry=industry,
                    company_size=size,
                    city=city,
                    country=country,
                    country_code="AU",
                    profile_completed=True,
                    contact_email=u.email,
                )

            global_job = 0
            for e, emp in enumerate(employers):
                row = COMPANY_ROWS[e]
                company_name = row[0]
                for j in range(JOBS_PER_EMPLOYER):
                    cat = categories[global_job % len(categories)]
                    slug = cat.slug
                    tier = ["Graduate", "Junior", "Mid-level", "Senior", "Lead"][global_job % 5]
                    title = f"{tier} {cat.name.split('—')[0].strip()} — team {e + 1}-{j + 1}"
                    mode = WORK_MODES[global_job % len(WORK_MODES)]
                    period = COMP_PERIODS[global_job % len(COMP_PERIODS)]
                    min_exp = global_job % 9
                    edu_req = ["", "Certificate", "Diploma", "Bachelor", "Master"][global_job % 5]
                    loc = row[3] if mode != JobPosting.WorkMode.REMOTE else "Australia (remote-friendly)"

                    jd = (
                        f"{company_name} is growing its {cat.name.lower()} capability. "
                        f"This role (listing #{global_job + 1}) focuses on delivery, collaboration, and clear reporting. "
                        f"Work mode: {mode}. Prior experience: {min_exp}+ years preferred where noted."
                    )

                    comp_min = comp_max = None
                    if period == JobPosting.CompensationPeriod.YEARLY:
                        base = 65000 + (global_job * 1371) % 95000
                        comp_min = Decimal(base)
                        comp_max = Decimal(base + 15000 + (global_job % 7) * 2000)
                    elif period == JobPosting.CompensationPeriod.HOURLY:
                        h = 32 + (global_job % 18)
                        comp_min = Decimal(h)
                        comp_max = Decimal(h + 8)

                    job = JobPosting.objects.create(
                        employer=emp,
                        job_category=cat,
                        title=title[:255],
                        company_info=company_name[:255],
                        jd_text=jd,
                        whats_on_offer=[
                            ["Flexible arrangements where possible", "Learning budget"],
                            ["Learning budget", "Employee assistance program"],
                            ["Employee assistance program", "Mentoring time"],
                        ][global_job % 3],
                        looking_for_people_bullets=[
                            "Clear communicator",
                            "Ownership of outcomes",
                            "Collaborative mindset",
                        ],
                        looking_for_additional_bullets=[
                            "Relevant certifications a plus",
                            "Right to work in Australia",
                        ],
                        role_bullets=[
                            "Deliver scoped work on schedule",
                            "Document decisions and handovers",
                            "Participate in reviews and retrospectives",
                        ],
                        why_choose_us_bullets=[
                            "Stable organisation with regional footprint",
                            "Investment in tools and safety",
                        ],
                        how_to_apply="Apply via SkillMesh with a short note on your recent impact.",
                        required_education=edu_req,
                        required_experience=min_exp,
                        work_mode=mode,
                        location=loc[:120],
                        status="open",
                        licenses_certifications="",
                        compensation_period=period,
                        compensation_amount_min=comp_min,
                        compensation_amount_max=comp_max,
                    )
                    for skill_name, weight in _skills_for_slug(slug, global_job):
                        JobSkill.objects.create(job=job, skill_name=skill_name[:100], weight=weight)
                    global_job += 1

            for c in range(NUM_CANDIDATES):
                p = personas[c]
                u = User.objects.create_user(
                    email=f"candidate{c + 1:02d}@skillmesh.dev",
                    username=f"candidate{c + 1:02d}",
                    password=DEFAULT_PASSWORD,
                    role=User.Role.CANDIDATE,
                )
                profile = CandidateProfile.objects.create(
                    user=u,
                    full_name=p["name"],
                    headline=p["headline"][:180],
                    summary=p["summary"],
                    location=p["city"],
                    country="Australia",
                    education_level=p["edu"],
                    major=p["major"][:120],
                    postcode=f"2{(c * 17) % 10}00",
                    mobile_number=f"04{(c * 11) % 90:02d} {(100 + c):03d} {(200 + c * 3) % 1000:03d}",
                    availability=["Immediate", "2 weeks", "4 weeks", "Open to contract"][c % 4],
                    preferred_mode=["remote", "hybrid", "onsite", ""][c % 4],
                    onboarding_step=CandidateProfile.OnboardingStep.DONE,
                    date_of_birth=date(1994 + (c % 8), 1 + (c % 12), 5 + (c % 20)),
                )
                inst, deg, field = p["school"]
                CandidateEducation.objects.create(
                    candidate=profile,
                    institution=inst,
                    degree=deg,
                    field_of_study=field,
                    major=p["major"],
                    start_date=date(2015 + (c % 5), 2, 1),
                    end_date=date(2019 + (c % 4), 11, 30),
                    is_current=False,
                    description="Coursework and capstone project.",
                    sort_order=0,
                )
                for wi, (title, company, desc) in enumerate(p["work"]):
                    WorkExperience.objects.create(
                        candidate=profile,
                        job_title=title,
                        company_name=company,
                        description=desc,
                        start_date=date(2020 + wi, 3, 1),
                        end_date=None if wi == 0 and c % 3 == 0 else date(2022 + wi, 8, 31),
                        is_current=wi == 0 and c % 3 == 0,
                        sort_order=wi,
                    )
                for skill_name, level in p["skills"]:
                    CandidateSkill.objects.create(
                        candidate=profile, skill_name=skill_name[:100], level=level
                    )
                profile.preferred_job_categories.set(_category_preferences_for_index(c, categories))

        self.stdout.write(self.style.SUCCESS("Bulk demo seed complete."))
        self.stdout.write(f"  Password (all accounts): {DEFAULT_PASSWORD}")
        self.stdout.write(f"  Employers: employer01@skillmesh.dev … employer{NUM_EMPLOYERS:02d}@skillmesh.dev")
        self.stdout.write(f"  Candidates: candidate01@skillmesh.dev … candidate{NUM_CANDIDATES:02d}@skillmesh.dev")
        self.stdout.write(f"  Jobs created: {NUM_EMPLOYERS * JOBS_PER_EMPLOYER}")
