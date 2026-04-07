from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        CANDIDATE = "candidate", "Candidate"
        EMPLOYER = "employer", "Employer"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]
