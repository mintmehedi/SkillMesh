from urllib.parse import quote, unquote, urlparse, urlunparse


def is_supabase_pooler_host(host: str) -> bool:
    return ".pooler.supabase.com" in (host or "")


def is_supabase_direct_host(host: str) -> bool:
    return (host or "").endswith(".supabase.co")


def supabase_project_ref_from_username(username: str) -> str | None:
    if username and username.startswith("postgres."):
        return username.split(".", 1)[1]
    return None


def _rebuild_database_url(parsed, *, host: str, port: int, username: str) -> str:
    password = unquote(parsed.password or "")
    path = parsed.path or "/postgres"
    netloc = f"{username}:{quote(password, safe='')}@{host}:{port}"
    return urlunparse(
        (
            parsed.scheme,
            netloc,
            path,
            parsed.params,
            parsed.query,
            parsed.fragment,
        )
    )


def pooler_to_direct_database_url(database_url: str) -> str | None:
    """Convert a Supabase pooler URI to a direct Postgres URI (for tests)."""
    parsed = urlparse(database_url)
    if not is_supabase_pooler_host(parsed.hostname):
        return None

    project_ref = supabase_project_ref_from_username(parsed.username)
    if not project_ref:
        return None

    return _rebuild_database_url(
        parsed,
        host=f"db.{project_ref}.supabase.co",
        port=parsed.port or 5432,
        username="postgres",
    )


def pooler_to_transaction_database_url(database_url: str) -> str | None:
    """Use Supabase transaction pooler (port 6543) to avoid session pool limits."""
    parsed = urlparse(database_url)
    if not is_supabase_pooler_host(parsed.hostname):
        return None
    if (parsed.port or 5432) == 6543:
        return database_url

    username = parsed.username or "postgres"
    return _rebuild_database_url(
        parsed,
        host=parsed.hostname,
        port=6543,
        username=username,
    )


def resolve_test_database_url(database_url: str) -> tuple[str, str]:
    """Pick the best remote test URI and describe which strategy was used."""
    transaction = pooler_to_transaction_database_url(database_url)
    if transaction:
        return transaction, "transaction-pooler"

    direct = pooler_to_direct_database_url(database_url)
    if direct:
        return direct, "direct"

    return database_url, "unchanged"
