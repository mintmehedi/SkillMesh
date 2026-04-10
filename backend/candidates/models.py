from django.conf import settings
from django.db import models


class CandidateProfile(models.Model):
    class OnboardingStep(models.TextChoices):
        SIGNUP = "signup", "Account created"
        RESUME = "resume", "Resume and experience"
        CATEGORIES = "categories", "Job category preferences"
        DONE = "done", "Onboarding complete"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="candidate_profile")
    full_name = models.CharField(max_length=255)
    contact = models.CharField(max_length=255, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    postcode = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=120, blank=True)
    mobile_number = models.CharField(max_length=32, blank=True)
    education_level = models.CharField(max_length=120, blank=True)
    major = models.CharField(max_length=120, blank=True)
    years_experience = models.PositiveIntegerField(default=0)  # pyright: ignore[reportArgumentType]
    location = models.CharField(max_length=120, blank=True)
    preferred_mode = models.CharField(max_length=20, blank=True)
    summary = models.TextField(blank=True)
    onboarding_step = models.CharField(
        max_length=20,
        choices=OnboardingStep.choices,
        default=OnboardingStep.RESUME,
    )
    preferred_job_categories = models.ManyToManyField(
        "employers.JobCategory",
        blank=True,
        related_name="preferred_by_candidates",
    )


class WorkExperience(models.Model):
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="work_experiences")
    job_title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)  # pyright: ignore[reportArgumentType]
    description = models.TextField(blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)  # pyright: ignore[reportArgumentType]

    class Meta:
        ordering = ["sort_order", "-start_date", "id"]


class CandidateSkill(models.Model):
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="skills")
    skill_name = models.CharField(max_length=100)
    level = models.PositiveSmallIntegerField(default=1)  # pyright: ignore[reportArgumentType]


class ResumeDocument(models.Model):
    candidate = models.ForeignKey(CandidateProfile, on_delete=models.CASCADE, related_name="resumes")
    file = models.FileField(upload_to="resumes/")
    raw_text = models.TextField(blank=True)
    parsed_json = models.JSONField(default=dict, blank=True)
    parsed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
