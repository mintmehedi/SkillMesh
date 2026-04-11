"""Shared employer workspace (primary account + invited teammates)."""


def workspace_owner(user):
    """
    Return the canonical employer user for jobs and company profile.

    Invited teammates set `employer_organization_owner` to the primary account.
    """
    u = user
    for _ in range(32):
        parent_id = getattr(u, "employer_organization_owner_id", None)
        if not parent_id:
            return u
        parent = getattr(u, "employer_organization_owner", None)
        if parent is None or parent.id == u.id:
            return u
        u = parent
    return u
