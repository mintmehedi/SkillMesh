from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


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


class CandidateMembership(models.Model):
    class PlanType(models.TextChoices):
        FREE = "free", "Free"
        PREMIUM = "premium", "Premium"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="candidate_membership",
        limit_choices_to={"role": User.Role.CANDIDATE},
    )
    plan_type = models.CharField(max_length=16, choices=PlanType.choices, default=PlanType.FREE)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    monthly_price = models.DecimalField(max_digits=6, decimal_places=2, default=5.99)
    member_since = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def activate_premium(self):
        self.plan_type = self.PlanType.PREMIUM
        self.status = self.Status.ACTIVE
        if not self.member_since:
            self.member_since = timezone.now()
        self.cancelled_at = None
        self.save(update_fields=["plan_type", "status", "member_since", "cancelled_at", "updated_at"])

    def cancel(self):
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_at", "updated_at"])


class CompanyMembership(models.Model):
    class PlanType(models.TextChoices):
        FREE = "free", "Free"
        PREMIUM = "premium", "Premium"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CANCELLED = "cancelled", "Cancelled"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="company_membership",
        limit_choices_to={"role": User.Role.EMPLOYER},
        help_text="Membership is tracked on the employer workspace owner.",
    )
    plan_type = models.CharField(max_length=16, choices=PlanType.choices, default=PlanType.FREE)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    monthly_price = models.DecimalField(max_digits=6, decimal_places=2, default=9.99)
    member_since = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def activate_premium(self):
        self.plan_type = self.PlanType.PREMIUM
        self.status = self.Status.ACTIVE
        if not self.member_since:
            self.member_since = timezone.now()
        self.cancelled_at = None
        self.save(update_fields=["plan_type", "status", "member_since", "cancelled_at", "updated_at"])

    def cancel(self):
        self.status = self.Status.CANCELLED
        self.cancelled_at = timezone.now()
        self.save(update_fields=["status", "cancelled_at", "updated_at"])
