"""Postgres trigram helpers for typo-tolerant keyword search."""

from collections.abc import Callable, Sequence

from django.conf import settings
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Case, FloatField, IntegerField, Q, QuerySet, Value, When
from django.db.models.functions import Coalesce, Greatest

FUZZY_MATCH_THRESHOLD = 0.18


def fuzzy_search_enabled() -> bool:
    return bool(getattr(settings, "FEATURE_FLAGS", {}).get("enable_text_similarity", True))


def keyword_tokens(keyword: str, *, min_length: int = 2) -> list[str]:
    return [t for t in keyword.lower().split() if len(t) >= min_length]


def token_conjunction_q(
    token_list: Sequence[str],
    predicate: Callable[[str], Q],
) -> Q:
    combined = Q()
    for tok in token_list:
        combined &= predicate(tok)
    return combined


def fuzzy_similarity_expr(term: str, *fields: str):
    """Best-match trigram similarity across one or more text fields."""
    sims = [TrigramSimilarity(field, term) for field in fields]
    if not sims:
        return Value(0.0, output_field=FloatField())
    expr = sims[0]
    for sim in sims[1:]:
        expr = Greatest(expr, sim)
    return Coalesce(expr, Value(0.0), output_field=FloatField())


def apply_keyword_filter(
    queryset: QuerySet,
    *,
    keyword: str,
    exact_q: Q,
    token_predicate: Callable[[str], Q],
    fuzzy_fields: Sequence[str],
    fuzzy_enabled: bool | None = None,
) -> QuerySet:
    """
    Match a keyword with exact icontains, per-token AND matching, or trigram similarity.

    When fuzzy search is enabled, rows match if they satisfy exact_q OR reach
    FUZZY_MATCH_THRESHOLD on any fuzzy field.
    """
    keyword = (keyword or "").strip()
    if not keyword:
        return queryset

    use_fuzzy = fuzzy_search_enabled() if fuzzy_enabled is None else fuzzy_enabled
    token_list = keyword_tokens(keyword)

    if token_list and not use_fuzzy:
        return queryset.filter(exact_q).filter(
            token_conjunction_q(token_list, token_predicate)
        ).distinct()

    if use_fuzzy:
        return (
            queryset.annotate(
                _fuzzy_score=fuzzy_similarity_expr(keyword, *fuzzy_fields)
            )
            .filter(exact_q | Q(_fuzzy_score__gte=FUZZY_MATCH_THRESHOLD))
            .distinct()
        )

    return queryset.filter(exact_q).distinct()


def fuzzy_rank_annotation() -> Case:
    return Case(
        When(_fuzzy_score__gte=0.35, then=Value(25)),
        When(_fuzzy_score__gte=0.28, then=Value(18)),
        When(_fuzzy_score__gte=0.22, then=Value(10)),
        default=Value(0),
        output_field=IntegerField(),
    )


def maybe_fuzzy_rank_annotation(fuzzy_enabled: bool | None = None) -> dict[str, Case]:
    if fuzzy_enabled if fuzzy_enabled is not None else fuzzy_search_enabled():
        return {"_rank_fuzzy": fuzzy_rank_annotation()}
    return {}
