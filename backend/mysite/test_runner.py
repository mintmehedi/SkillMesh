from django.test.runner import DiscoverRunner


def _uses_remote_supabase() -> bool:
    from django.conf import settings

    from mysite.db_url import is_supabase_direct_host, is_supabase_pooler_host

    host = settings.DATABASES["default"].get("HOST") or ""
    return is_supabase_pooler_host(host) or is_supabase_direct_host(host)


class SkillMeshDiscoverRunner(DiscoverRunner):
    """Reuse the test DB on remote Supabase (pooler limits and shared teardown)."""

    def __init__(self, *args, **kwargs):
        self._auto_keepdb = False
        if (
            _uses_remote_supabase()
            and not kwargs.get("keepdb")
            and not kwargs.get("parallel", 0)
        ):
            kwargs["keepdb"] = True
            self._auto_keepdb = True
        super().__init__(*args, **kwargs)

    def run_tests(self, test_labels, **kwargs):
        if self.verbosity >= 1:
            from django.conf import settings

            strategy = getattr(settings, "_TEST_DB_STRATEGY", None)
            if strategy == "transaction-pooler":
                print(
                    "Supabase session pooler detected: using transaction pooler "
                    "(port 6543) for tests."
                )
            if self._auto_keepdb:
                print(
                    "Remote Supabase detected: preserving test database (--keepdb). "
                    "Set TEST_DATABASE_URL to a local Postgres URI for isolated test "
                    "databases."
                )
        return super().run_tests(test_labels, **kwargs)
