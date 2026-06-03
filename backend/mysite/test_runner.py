from django.test.runner import DiscoverRunner


def _uses_supabase_pooler() -> bool:
    from django.conf import settings

    host = settings.DATABASES["default"].get("HOST") or ""
    return ".pooler.supabase.com" in host


class SkillMeshDiscoverRunner(DiscoverRunner):
    """Reuse the test DB when Supabase's pooler holds connections open after tests."""

    def __init__(self, *args, **kwargs):
        self._auto_keepdb = False
        if (
            _uses_supabase_pooler()
            and not kwargs.get("keepdb")
            and not kwargs.get("parallel", 0)
        ):
            kwargs["keepdb"] = True
            self._auto_keepdb = True
        super().__init__(*args, **kwargs)

    def run_tests(self, test_labels, **kwargs):
        if self._auto_keepdb and self.verbosity >= 1:
            print(
                "Supabase pooler detected: preserving test database (--keepdb). "
                "Set TEST_DATABASE_URL to a direct or local Postgres URI for "
                "isolated test databases."
            )
        return super().run_tests(test_labels, **kwargs)
