import uuid
from typing import ClassVar

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class JobPostingQuerySet(models.QuerySet):
    """Jobs visible on the public site (open and not past optional closing date)."""

    def public_live(self):
        today = timezone.now().date()
        return self.filter(status="open").filter(Q(closing_date__isnull=True) | Q(closing_date__gte=today))


class JobPostingManager(models.Manager):
    """Typed manager so checkers see QuerySet helpers like ``public_live``."""

    def get_queryset(self):
        return JobPostingQuerySet(self.model, using=self._db)

    def public_live(self):
        return self.get_queryset().public_live()


class JobCategory(models.Model):
    """Popular job types for candidate preferences and job classification."""

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class CompanyProfile(models.Model):
    """Employer organisation details (one per employer user)."""

    class CompanySize(models.TextChoices):
        R1_10 = "1-10", "1–10 employees"
        R11_50 = "11-50", "11–50 employees"
        R51_200 = "51-200", "51–200 employees"
        R201_500 = "201-500", "201–500 employees"
        R501_1000 = "501-1000", "501–1,000 employees"
        R1000_PLUS = "1000+", "1,000+ employees"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="company_profile",
    )
    company_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(
        max_length=255,
        blank=True,
        help_text="Short public location line (e.g. shown on job listings).",
    )
    industry = models.CharField(max_length=120, blank=True)
    company_size = models.CharField(max_length=20, choices=CompanySize.choices, blank=True)
    founded_year = models.PositiveSmallIntegerField(null=True, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    contact_email = models.EmailField(blank=True)
    country = models.CharField(max_length=120, blank=True)
    country_code = models.CharField(
        max_length=2,
        blank=True,
        help_text="ISO 3166-1 alpha-2, for address lookups.",
    )
    state_region = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=120, blank=True)
    suburb = models.CharField(
        max_length=120,
        blank=True,
        help_text="Suburb / district (separate from city or town).",
    )
    street_address = models.CharField(max_length=255, blank=True)
    postcode = models.CharField(max_length=20, blank=True)
    business_registration_number = models.CharField(
        max_length=64,
        blank=True,
        help_text="ABN, ACN, or other business registration identifier.",
    )
    linkedin_url = models.URLField(blank=True)
    profile_completed = models.BooleanField(default=False)


class JobPosting(models.Model):
    objects: ClassVar[JobPostingManager] = JobPostingManager()

    class WorkMode(models.TextChoices):
        REMOTE = "remote", "Remote"
        ONSITE = "onsite", "On-site"
        HYBRID = "hybrid", "Hybrid"

    class CompensationPeriod(models.TextChoices):
        NOT_SPECIFIED = "not_specified", "Not specified"
        HOURLY = "hourly", "Hourly"
        YEARLY = "yearly", "Yearly (salary)"
        MONTHLY = "monthly", "Monthly"
        DAILY = "daily", "Daily"

    employer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="jobs")
    job_category = models.ForeignKey(
        JobCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )
    title = models.CharField(max_length=255, blank=True)
    company_info = models.CharField(max_length=255, blank=True)
    jd_text = models.TextField(
        blank=True,
        help_text="Opening summary: context, team, and why the role exists.",
    )
    whats_on_offer = models.JSONField(
        default=list,
        blank=True,
        help_text="Bullet list of benefits, perks, and what the hire gains (stored as JSON array of strings).",
    )
    looking_for_people_bullets = models.JSONField(
        default=list,
        blank=True,
        help_text='Bullets after "We are looking for people who:".',
    )
    looking_for_additional_bullets = models.JSONField(
        default=list,
        blank=True,
        help_text='Bullets after "In addition, you will need:" (licences, experience, etc.).',
    )
    role_bullets = models.JSONField(
        default=list,
        blank=True,
        help_text='Bullets after "In this role you will be providing, such as:".',
    )
    why_choose_us_bullets = models.JSONField(
        default=list,
        blank=True,
        help_text='Bullets after the fixed "Why choose us" line (culture, mission, accreditation, growth).',
    )
    how_to_apply = models.TextField(
        blank=True,
        help_text="Application steps, documents to include, and timeline.",
    )
    required_education = models.CharField(max_length=120, blank=True)
    required_experience = models.PositiveIntegerField(default=0)
    work_mode = models.CharField(max_length=20, choices=WorkMode.choices, default=WorkMode.ONSITE)
    location = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, default="open")
    closing_date = models.DateField(
        null=True,
        blank=True,
        help_text="Last day the job is advertised publicly; after this date it is hidden unless status is reopened.",
    )
    licenses_certifications = models.TextField(
        blank=True,
        help_text="Optional licences, certifications, or clearances for this role.",
    )
    compensation_period = models.CharField(
        max_length=32,
        choices=CompensationPeriod.choices,
        default=CompensationPeriod.NOT_SPECIFIED,
    )
    compensation_amount_min = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional lower bound; currency implied by employer / region.",
    )
    compensation_amount_max = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional upper bound.",
    )
    created_at = models.DateTimeField(auto_now_add=True)


class JobSkill(models.Model):
    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name="skills")
    skill_name = models.CharField(max_length=100)
    weight = models.PositiveSmallIntegerField(default=1)


class EmployerTeamInvite(models.Model):
    """Email invite so a colleague can register as an employer and join the same workspace."""

    email = models.EmailField(help_text="Invitee must register with this exact email.")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employer_team_invites_sent",
    )
    organization_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employer_team_invites_for_org",
        help_text="Canonical employer user (workspace root) whose jobs and company profile are shared.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["organization_owner", "email"]),
            models.Index(fields=["token"]),
        ]

    def __str__(self):
        org_id = getattr(self, "organization_owner_id", None)
        return f"EmployerTeamInvite({self.email} → org {org_id})"
