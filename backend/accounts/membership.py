from decimal import Decimal

from .models import CandidateMembership, User

MEMBERSHIP_PRICE = Decimal("5.99")
MEMBERSHIP_BENEFITS = [
    "Unlimited recommended jobs on homepage",
    "Unlimited saved searches",
    "Unlimited labeled resumes in Manage resumes",
]


def get_or_create_membership(user: User) -> CandidateMembership | None:
    if not user or user.role != User.Role.CANDIDATE:
        return None
    membership, _ = CandidateMembership.objects.get_or_create(
        user=user,
        defaults={"monthly_price": MEMBERSHIP_PRICE},
    )
    return membership


def is_premium_candidate(user: User) -> bool:
    membership = get_or_create_membership(user)
    return bool(
        membership
        and membership.plan_type == CandidateMembership.PlanType.PREMIUM
        and membership.status == CandidateMembership.Status.ACTIVE
    )
