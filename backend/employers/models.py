from django.conf import settings
from django.db import models


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
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_profile")
    company_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    location = models.CharField(max_length=120, blank=True)


class JobPosting(models.Model):
    class WorkMode(models.TextChoices):
        REMOTE = "remote", "Remote"
        ONSITE = "onsite", "On-site"
        HYBRID = "hybrid", "Hybrid"

    employer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="jobs")
    job_category = models.ForeignKey(
        JobCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )
    title = models.CharField(max_length=255)
    company_info = models.CharField(max_length=255, blank=True)
    jd_text = models.TextField()
    required_education = models.CharField(max_length=120, blank=True)
    required_experience = models.PositiveIntegerField(default=0)
    work_mode = models.CharField(max_length=20, choices=WorkMode.choices, default=WorkMode.ONSITE)
    location = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, default="open")
    created_at = models.DateTimeField(auto_now_add=True)


class JobSkill(models.Model):
    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name="skills")
    skill_name = models.CharField(max_length=100)
    weight = models.PositiveSmallIntegerField(default=1)
