from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CANDIDATE = "candidate", "Candidate"
        EMPLOYER = "employer", "Employer"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)
    employer_organization_owner = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employer_team_members",
        limit_choices_to={"role": Role.EMPLOYER},
        help_text="If set, this employer account shares the primary owner's jobs and company profile.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
