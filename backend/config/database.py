"""Strict environment configuration; credentials never enter browser configuration."""
from urllib.parse import parse_qs, unquote, urlsplit

from django.core.exceptions import ImproperlyConfigured


def database_config(url, data_dir):
    if not url:
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": data_dir / "likha.sqlite3",
                "OPTIONS": {"timeout": 15, "transaction_mode": "IMMEDIATE"},
                "TEST": {"NAME": data_dir / "test-likha.sqlite3"}}
    try:
        parsed = urlsplit(url)
        query = parse_qs(parsed.query, strict_parsing=True)
        if (parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname
                or not parsed.username or not parsed.password or not parsed.path.strip("/")
                or parsed.fragment or set(query) - {"sslmode"}
                or query.get("sslmode", ["require"]) != ["require"]):
            raise ValueError
        return {"ENGINE": "django.db.backends.postgresql", "NAME": unquote(parsed.path[1:]),
                "USER": unquote(parsed.username), "PASSWORD": unquote(parsed.password),
                "HOST": parsed.hostname, "PORT": parsed.port or 5432,
                "CONN_MAX_AGE": 0, "DISABLE_SERVER_SIDE_CURSORS": True,
                "OPTIONS": {"sslmode": "require", "connect_timeout": 10, "prepare_threshold": None,
                            "options": "-c search_path=likha,pg_catalog -c statement_timeout=30000 -c lock_timeout=10000"}}
    except (ValueError, TypeError):
        raise ImproperlyConfigured("DATABASE_URL must be a PostgreSQL URL with credentials and sslmode=require.") from None
