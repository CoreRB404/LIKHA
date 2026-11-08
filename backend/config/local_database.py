"""Read private loopback PostgreSQL configuration; never return it to the browser."""
import json
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


def local_database(path):
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
        if (value["host"] != "127.0.0.1" or not 1 <= int(value["port"]) <= 65535
                or value["database"] != "likha" or value["user"] != "likha_local"
                or not isinstance(value["password"], str) or len(value["password"]) < 32):
            raise ValueError
        return {"ENGINE": "django.db.backends.postgresql", "NAME": value["database"],
                "USER": value["user"], "PASSWORD": value["password"], "HOST": value["host"],
                "PORT": value["port"], "CONN_MAX_AGE": 0, "DISABLE_SERVER_SIDE_CURSORS": True,
                "OPTIONS": {"sslmode": "disable", "connect_timeout": 10, "prepare_threshold": None,
                            "options": "-c search_path=likha,pg_catalog -c statement_timeout=30000 -c lock_timeout=10000"}}
    except (OSError, ValueError, KeyError, TypeError):
        raise ImproperlyConfigured("Local PostgreSQL configuration is invalid. Run tools/local_postgres.py status; do not fall back to SQLite.") from None
