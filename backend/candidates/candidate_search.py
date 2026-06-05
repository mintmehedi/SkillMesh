"""Employer candidate directory search: keyword, filters, fuzzy matching, and relevance ranking."""

from django.db.models import Case, IntegerField, Q, Value, When

from core.search_fuzzy import apply_keyword_filter, fuzzy_search_enabled, maybe_fuzzy_rank_annotation
from .models import CandidateProfile

_CANDIDATE_FUZZY_FIELDS = (
    "full_name",
    "headline",
    "summary",
    "major",
    "education_level",
    "location",
    "postcode",
    "country",
    "availability",
    "preferred_mode",
    "skills__skill_name",
    "work_experiences__job_title",
    "work_experiences__company_name",
    "work_experiences__description",
    "education_entries__institution",
    "education_entries__degree",
    "education_entries__field_of_study",
    "education_entries__major",
    "education_entries__description",
    "preferred_job_categories__name",
)


def _profile_keyword_q(term: str) -> Q:
    t = (term or "").strip()
    if not t:
        return Q()
    return (
        Q(full_name__icontains=t)
        | Q(headline__icontains=t)
        | Q(summary__icontains=t)
        | Q(major__icontains=t)
        | Q(education_level__icontains=t)
        | Q(location__icontains=t)
        | Q(postcode__icontains=t)
        | Q(country__icontains=t)
        | Q(availability__icontains=t)
        | Q(preferred_mode__icontains=t)
        | Q(skills__skill_name__icontains=t)
        | Q(work_experiences__job_title__icontains=t)
        | Q(work_experiences__company_name__icontains=t)
        | Q(work_experiences__description__icontains=t)
        | Q(education_entries__institution__icontains=t)
        | Q(education_entries__degree__icontains=t)
        | Q(education_entries__field_of_study__icontains=t)
        | Q(education_entries__major__icontains=t)
        | Q(education_entries__description__icontains=t)
        | Q(preferred_job_categories__name__icontains=t)
    )


def _profile_token_q(tok: str) -> Q:
    return (
        Q(full_name__icontains=tok)
        | Q(headline__icontains=tok)
        | Q(skills__skill_name__icontains=tok)
        | Q(work_experiences__job_title__icontains=tok)
        | Q(work_experiences__company_name__icontains=tok)
        | Q(work_experiences__description__icontains=tok)
        | Q(education_level__icontains=tok)
        | Q(major__icontains=tok)
        | Q(summary__icontains=tok)
        | Q(education_entries__degree__icontains=tok)
        | Q(education_entries__institution__icontains=tok)
        | Q(preferred_job_categories__name__icontains=tok)
    )


def _location_q(term: str) -> Q:
    t = (term or "").strip()
    if not t:
        return Q()
    return (
        Q(location__icontains=t)
        | Q(postcode__icontains=t)
        | Q(country__icontains=t)
    )


def _education_q(term: str) -> Q:
    t = (term or "").strip()
    if not t:
        return Q()
    return (
        Q(education_level__icontains=t)
        | Q(major__icontains=t)
        | Q(education_entries__degree__icontains=t)
        | Q(education_entries__field_of_study__icontains=t)
        | Q(education_entries__major__icontains=t)
        | Q(education_entries__institution__icontains=t)
        | Q(education_entries__description__icontains=t)
    )


def filter_candidate_queryset(qs, request):
    """
    Apply query-string filters to a CandidateProfile queryset.
    Supports: keyword, skills, education, location, category, preferred_mode, loc_terms.
    """
    keyword = (request.query_params.get("keyword") or "").strip()
    skills = (request.query_params.get("skills") or "").strip()
    education = (request.query_params.get("education") or "").strip()
    location = (request.query_params.get("location") or "").strip()
    loc_terms_raw = (request.query_params.get("loc_terms") or "").strip()
    fuzzy_enabled = fuzzy_search_enabled()

    if skills and not keyword:
        keyword = skills
    elif skills and keyword:
        qs = qs.filter(skills__skill_name__icontains=skills)

    if keyword:
        qs = apply_keyword_filter(
            qs,
            keyword=keyword,
            exact_q=_profile_keyword_q(keyword),
            token_predicate=_profile_token_q,
            fuzzy_fields=_CANDIDATE_FUZZY_FIELDS,
            fuzzy_enabled=fuzzy_enabled,
        )

    if education:
        qs = qs.filter(_education_q(education)).distinct()

    terms: list[str] = []
    if loc_terms_raw:
        terms = [t.strip().lower() for t in loc_terms_raw.split(",") if len(t.strip()) >= 2]
    elif location:
        parts = [t.strip().lower() for t in location.split(",") if len(t.strip()) >= 2]
        terms = parts if parts else ([location.lower()] if len(location) >= 2 else [])

    for t in terms:
        qs = qs.filter(_location_q(t)).distinct()

    cat = (request.query_params.get("category") or "").strip()
    if cat.isdigit():
        qs = qs.filter(preferred_job_categories__id=int(cat)).distinct()

    mode = (request.query_params.get("preferred_mode") or request.query_params.get("work_mode") or "").strip().lower()
    if mode in {"remote", "hybrid", "onsite"}:
        qs = qs.filter(preferred_mode__icontains=mode)

    search_term = keyword or skills
    if search_term:
        annotations = {
            "_rank_name": Case(
                When(full_name__icontains=search_term, then=Value(50)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            "_rank_headline": Case(
                When(headline__icontains=search_term, then=Value(45)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            "_rank_skill": Case(
                When(skills__skill_name__icontains=search_term, then=Value(40)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            "_rank_role": Case(
                When(work_experiences__job_title__icontains=search_term, then=Value(30)),
                default=Value(0),
                output_field=IntegerField(),
            ),
            "_rank_summary": Case(
                When(summary__icontains=search_term, then=Value(15)),
                default=Value(0),
                output_field=IntegerField(),
            ),
        }
        annotations.update(maybe_fuzzy_rank_annotation(fuzzy_enabled))
        qs = qs.annotate(**annotations)
        order = ["-_rank_name", "-_rank_headline", "-_rank_skill"]
        if fuzzy_enabled:
            order.append("-_rank_fuzzy")
        order.extend(["-_rank_role", "-_rank_summary", "-id"])
        qs = qs.order_by(*order)
        return qs.distinct()

    return qs.distinct().order_by("-id")


def employer_candidate_search_queryset():
    return CandidateProfile.objects.prefetch_related(
        "skills",
        "work_experiences",
        "education_entries",
        "preferred_job_categories",
    )
