from django.db.backends.postgresql.base import DatabaseWrapper as PostgresqlDatabaseWrapper
from django.db.backends.postgresql.creation import DatabaseCreation as PostgresqlDatabaseCreation


class DatabaseCreation(PostgresqlDatabaseCreation):
    def _terminate_test_db_connections(self, test_database_name):
        with self._nodb_cursor() as cursor:
            cursor.execute(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = %s AND pid <> pg_backend_pid()
                """,
                [test_database_name],
            )

    def _destroy_test_db(self, test_database_name, verbosity):
        self.connection.close_pool()
        self._terminate_test_db_connections(test_database_name)
        return super()._destroy_test_db(test_database_name, verbosity)

    def _clone_test_db(self, suffix, verbosity, keepdb=False):
        target_database_name = self.get_test_db_clone_settings(suffix)["NAME"]
        if not keepdb:
            self._terminate_test_db_connections(target_database_name)
        return super()._clone_test_db(suffix, verbosity, keepdb=keepdb)


class DatabaseWrapper(PostgresqlDatabaseWrapper):
    creation_class = DatabaseCreation
