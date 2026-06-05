"""Postgres trigram helpers for typo-tolerant search."""

from django.conf import settings
from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import FloatField, Value
from django.db.models.functions import Coalesce, Greatest


def fuzzy_search_enabled() -> bool:
    return bool(getattr(settings, "FEATURE_FLAGS", {}).get("enable_text_similarity", True))


def fuzzy_similarity_expr(*fields: str, term: str):
    """Build a best-match similarity expression across a list of text fields."""
    sims = [TrigramSimilarity(field, term) for field in fields]
    if not sims:
        return Value(0.0, output_field=FloatField())
    expr = sims[0]
    for sim in sims[1:]:
        expr = Greatest(expr, sim)
    return Coalesce(expr, Value(0.0), output_field=FloatField())
