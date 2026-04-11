from django.conf import settings
from django.db import models

from employers.models import JobPosting


class Application(models.Model):
    class Status(models.TextChoices):
        APPLIED = "applied", "Applied"
        REVIEWING = "reviewing", "Reviewing"
        REJECTED = "rejected", "Rejected"
        ACCEPTED = "accepted", "Accepted"

    class CoverLetterMode(models.TextChoices):
        NONE = "none", "No cover letter"
        IN_APP = "in_app", "Written on SkillMesh"
        UPLOAD = "upload", "Uploaded file"

    candidate = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications")
    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name="applications")
    resume = models.ForeignKey(
        "candidates.ResumeDocument",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="applications",
    )
    cover_letter_mode = models.CharField(
        max_length=16,
        choices=CoverLetterMode.choices,
        default=CoverLetterMode.NONE,
    )
    cover_letter_text = models.TextField(blank=True)
    cover_letter_file = models.FileField(upload_to="cover_letters/", blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPLIED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("candidate", "job")
