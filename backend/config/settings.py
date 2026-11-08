"""Explicit development/production settings; no repository-root file serving."""
import os
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parents[1]
if os.name != "nt":
    os.umask(0o077)
ROOT = BASE_DIR.parent
ENVIRONMENT = os.environ.get("LIKHA_ENV", "development")
PRODUCTION = ENVIRONMENT == "production"
DEBUG = not PRODUCTION
DATA_DIR = Path(os.environ.get("LIKHA_DATA_DIR", ROOT / "var")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
from .secret_key import normalize_secret
SECRET_KEY = normalize_secret(SECRET_KEY, on_render=os.environ.get("RENDER") == "true")
if not SECRET_KEY:
    if PRODUCTION:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY is required in production.")
    # Persist a unique local key without putting it into source control.
    from django.core.management.utils import get_random_secret_key
    secret_file = DATA_DIR / "development-secret"
    try:
        with secret_file.open("x", encoding="utf-8") as stream:
            stream.write(get_random_secret_key())
    except FileExistsError:
        pass
    SECRET_KEY = secret_file.read_text(encoding="utf-8").strip()

# Render supplies its assigned hostname at build time and runtime. Initial
# Blueprint setup therefore does not require guessing an unavailable URL.
render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_host:
    import re
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.onrender\.com", render_host):
        raise ImproperlyConfigured("Invalid Render-provided hostname.")
default_origin = "https://" + render_host if render_host else "http://127.0.0.1:8000"
CANONICAL_ORIGIN = (os.environ.get("LIKHA_ORIGIN") or default_origin).rstrip("/")
default_hosts = render_host if render_host else ("localhost,127.0.0.1,[::1],testserver" if not PRODUCTION else "")
ALLOWED_HOSTS = [x.strip() for x in (os.environ.get("DJANGO_ALLOWED_HOSTS") or default_hosts).split(",") if x.strip()]
CSRF_TRUSTED_ORIGINS = [CANONICAL_ORIGIN]
PRIVATE_MEDIA_ROOT = DATA_DIR / "artworks"
PRIVATE_MEDIA_ROOT.mkdir(exist_ok=True)
STATIC_URL = "/static/"
STATIC_ROOT = Path(os.environ.get("LIKHA_STATIC_ROOT", DATA_DIR / "staticfiles")).resolve()
PUBLIC_ROOT = BASE_DIR / "public"
STATICFILES_DIRS = [PUBLIC_ROOT] if PUBLIC_ROOT.exists() else []
from .database import database_config
from .local_database import local_database
LOCAL_DATABASE_FILE = DATA_DIR / "local-postgres.json"
if not PRODUCTION and not os.environ.get("DATABASE_URL") and LOCAL_DATABASE_FILE.exists():
    DATABASES = {"default": local_database(LOCAL_DATABASE_FILE)}
elif not PRODUCTION and not os.environ.get("DATABASE_URL") and (DATA_DIR / "postgresql-active").exists():
    raise ImproperlyConfigured("This installation uses PostgreSQL. Restore its private local-postgres.json; SQLite fallback is disabled.")
else:
    DATABASES = {"default": database_config(os.environ.get("DATABASE_URL", ""), DATA_DIR)}
MEDIA_BACKEND = os.environ.get("LIKHA_MEDIA_BACKEND", "local")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "likha-private")
if MEDIA_BACKEND not in {"local", "supabase"}:
    raise ImproperlyConfigured("LIKHA_MEDIA_BACKEND must be local or supabase.")
if MEDIA_BACKEND == "supabase":
    import re
    storage_origin = urlsplit(SUPABASE_URL)
    if (storage_origin.scheme != "https" or not storage_origin.hostname
            or storage_origin.path or storage_origin.query or storage_origin.fragment
            or storage_origin.username or storage_origin.password
            or not SUPABASE_SERVICE_ROLE_KEY
            or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,62}", SUPABASE_STORAGE_BUCKET)):
        raise ImproperlyConfigured("Supabase storage needs an HTTPS project origin, server service-role key and bucket name.")
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"
INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "django_otp", "django_otp.plugins.otp_totp", "django_otp.plugins.otp_static",
    "accounts.apps.AccountsConfig", "learning.apps.LearningConfig",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "core.middleware.BoundaryMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django_otp.middleware.OTPMiddleware",
    "core.middleware.SessionPolicyMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [BASE_DIR / "templates"], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "accounts.validators.PasswordLengthValidator"},
    {"NAME": "accounts.validators.BreachedPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_BLOCKLIST = Path(os.environ.get("LIKHA_PASSWORD_BLOCKLIST", BASE_DIR / "accounts/breached-passwords.sha1"))
PASSWORD_BREACH_MODE = os.environ.get("LIKHA_PASSWORD_BREACH_MODE", "offline")
if PASSWORD_BREACH_MODE not in {"offline", "online"}:
    raise ImproperlyConfigured("LIKHA_PASSWORD_BREACH_MODE must be offline or online.")
PASSWORD_HASHERS = ["django.contrib.auth.hashers.Argon2PasswordHasher", "django.contrib.auth.hashers.PBKDF2PasswordHasher"]
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = PRODUCTION
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_NAME = "__Host-likha" if PRODUCTION else "likha_session"
SESSION_COOKIE_AGE = 12 * 3600
SESSION_SAVE_EVERY_REQUEST = False
CSRF_COOKIE_SECURE = PRODUCTION
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_FAILURE_VIEW = "core.http.csrf_failure"
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/dashboard.html"
LOGOUT_REDIRECT_URL = "/"
SECURE_SSL_REDIRECT = PRODUCTION
SECURE_REDIRECT_EXEMPT = [r"^health/live$"]
SECURE_HSTS_SECONDS = 31536000 if PRODUCTION else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
# Intentional: this application cannot assert TLS policy for unrelated subdomains
# or enroll an operator's domain in a long-lived browser preload list.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
# Only enable behind the documented proxy that overwrites these headers.
TRUST_PROXY = os.environ.get("LIKHA_TRUST_PROXY") == "1"
PROXY_MODE = os.environ.get("LIKHA_PROXY_MODE", "single")
if PROXY_MODE not in {"single", "render"}:
    raise ImproperlyConfigured("LIKHA_PROXY_MODE must be single or render.")
if TRUST_PROXY:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = False
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 40
DATA_UPLOAD_MAX_NUMBER_FILES = 1
# This application uses username/password accounts and never sends account email.
EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"
TIME_ZONE = "Asia/Manila"
USE_TZ = True
LANGUAGE_CODE = "en-us"
HEALTH_TOKEN = os.environ.get("LIKHA_HEALTH_TOKEN", "")
PRIVACY_CONTACT = os.environ.get("LIKHA_PRIVACY_CONTACT", "the site administrator")
PRIVACY_APPROVED = os.environ.get("LIKHA_PRIVACY_APPROVED") == "1"
ARTWORK_QUOTA_BYTES = 100 * 1024 * 1024
ARTWORK_REWARD_DAILY_LIMIT = 10
LOGGING = {"version": 1, "disable_existing_loggers": False, "handlers": {"console": {"class": "logging.StreamHandler"}}, "loggers": {"django.security": {"handlers": ["console"], "level": "ERROR", "propagate": False}}}

if PRODUCTION:
    parsed = urlsplit(CANONICAL_ORIGIN)
    if len(SECRET_KEY) < 50:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be at least 50 characters, or a Render-generated 256-bit secret.")
    if not ALLOWED_HOSTS or any("*" in h for h in ALLOWED_HOSTS):
        raise ImproperlyConfigured("Production requires explicit allowed hosts or a Render-provided hostname.")
    if parsed.scheme != "https" or not parsed.hostname or parsed.path or parsed.username or parsed.query or parsed.fragment:
        raise ImproperlyConfigured("LIKHA_ORIGIN must be a canonical HTTPS origin.")
    if not PRIVACY_APPROVED or PRIVACY_CONTACT == "the site administrator" or not HEALTH_TOKEN:
        raise ImproperlyConfigured("Production requires privacy approval/contact and a readiness token.")
    for public_path in (STATIC_ROOT, PUBLIC_ROOT):
        if DATA_DIR == public_path or DATA_DIR.is_relative_to(public_path) or public_path.is_relative_to(PRIVATE_MEDIA_ROOT):
            raise ImproperlyConfigured("Private data must not overlap a public asset directory.")
