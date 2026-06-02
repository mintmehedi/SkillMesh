from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AuthAnonThrottle(AnonRateThrottle):
    scope = "auth_anon"


class AuthUserThrottle(UserRateThrottle):
    scope = "auth_user"


class MetaAutocompleteThrottle(AnonRateThrottle):
    """Public geo/username autocomplete endpoints."""

    scope = "meta_autocomplete"
