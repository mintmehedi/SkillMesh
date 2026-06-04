from decimal import Decimal

from .models import CandidateMembership, CompanyMembership, User

MEMBERSHIP_PRICE = Decimal("5.99")
MEMBERSHIP_BENEFITS = [
    "Unlimited recommended jobs on homepage",
    "Unlimited saved searches",
    "Unlimited labeled resumes in Manage resumes",
]

COMPANY_MEMBERSHIP_BENEFITS = [
    "Unlimited recommended candidates for your jobs",
    "Unlimited candidate recommendations across your workspace",
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


def get_or_create_company_membership(user: User) -> CompanyMembership | None:
    if not user or user.role != User.Role.EMPLOYER:
        return None
    owner = user.employer_organization_owner or user
    membership, _ = CompanyMembership.objects.get_or_create(
        user=owner,
        defaults={"monthly_price": Decimal("9.99")},
    )
    return membership


def is_premium_company(user: User) -> bool:
    membership = get_or_create_company_membership(user)
    return bool(
        membership
        and membership.plan_type == CompanyMembership.PlanType.PREMIUM
        and membership.status == CompanyMembership.Status.ACTIVE
    )
