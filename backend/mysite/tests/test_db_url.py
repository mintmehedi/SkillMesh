from django.test import SimpleTestCase

from mysite.db_url import (
    pooler_to_direct_database_url,
    pooler_to_transaction_database_url,
    resolve_test_database_url,
)


class PoolerToDirectDatabaseUrlTests(SimpleTestCase):
    def test_converts_supabase_pooler_uri(self):
        pooler = (
            "postgresql://postgres.zjolkgcmkyxfzwktsjxd:secret%40pass@"
            "aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
        )
        direct = pooler_to_direct_database_url(pooler)
        self.assertEqual(
            direct,
            "postgresql://postgres:secret%40pass@"
            "db.zjolkgcmkyxfzwktsjxd.supabase.co:5432/postgres",
        )

    def test_returns_none_for_non_pooler_uri(self):
        direct = "postgresql://postgres:pass@127.0.0.1:5432/skillmesh_test"
        self.assertIsNone(pooler_to_direct_database_url(direct))

    def test_converts_pooler_to_transaction_mode(self):
        pooler = (
            "postgresql://postgres.zjolkgcmkyxfzwktsjxd:secret@"
            "aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
        )
        transaction = pooler_to_transaction_database_url(pooler)
        self.assertEqual(
            transaction,
            "postgresql://postgres.zjolkgcmkyxfzwktsjxd:secret@"
            "aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
        )

    def test_resolve_prefers_transaction_pooler(self):
        pooler = (
            "postgresql://postgres.zjolkgcmkyxfzwktsjxd:secret@"
            "aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
        )
        resolved, strategy = resolve_test_database_url(pooler)
        self.assertEqual(strategy, "transaction-pooler")
        self.assertIn(":6543/", resolved)
