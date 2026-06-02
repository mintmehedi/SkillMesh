import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get("DEBUG", "False").lower() == "true"

def _build_allowed_hosts() -> list[str]:
    explicit = os.environ.get("ALLOWED_HOSTS", "").strip()
    if explicit:
        return [h.strip() for h in explicit.split(",") if h.strip()]
    hosts = ["127.0.0.1", "localhost"]
    vercel_url = (os.environ.get("VERCEL_URL") or "").strip()
    if vercel_url:
        hosts.append(vercel_url)
    return hosts


ALLOWED_HOSTS = _build_allowed_hosts()


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'accounts',
    'candidates',
    'employers',
    'applications',
    'matching',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mysite.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mysite.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

# Prefer DATABASE_URL; README also documents SUPABASE_DB_URI for the same value.
_raw_db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URI")
DATABASE_URL = (_raw_db_url or "").strip().strip('"').strip("'")
if not DATABASE_URL:
    # Vercel's Python build imports Django settings; DATABASE_URL must exist in the
    # Vercel project for runtime (and for builds that run DB commands). If it is not
    # set yet, use a parseable placeholder so the build can finish — the API will not
    # work until you add DATABASE_URL or SUPABASE_DB_URI in the Vercel dashboard.
    if os.environ.get("VERCEL"):
        DATABASE_URL = (
            "postgres://vercel_build_placeholder:vercel_build_placeholder@"
            "127.0.0.1:5432/postgres"
        )
    else:
        raise RuntimeError(
            "Set DATABASE_URL or SUPABASE_DB_URI in backend/.env (PostgreSQL connection URI from Supabase)."
        )

is_postgres = DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")
try:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL, conn_max_age=600, ssl_require=is_postgres
        ),
    }
except dj_database_url.ParseError as exc:
    raise RuntimeError(
        "DATABASE_URL is not a valid PostgreSQL URI. Common causes: (1) The literal "
        "placeholder [YOUR-PASSWORD] from Supabase docs must be replaced with your real "
        "database password (no square brackets). (2) Passwords with @ # % : / ? + or "
        "spaces must be URL-encoded (e.g. @ → %40). "
        "Supabase: Project Settings → Database → Connection string (URI)."
    ) from exc

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.JWTCookieAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON", "60/hour"),
        "user": os.environ.get("THROTTLE_USER", "600/hour"),
        "auth_anon": os.environ.get("THROTTLE_AUTH_ANON", "30/hour"),
        "auth_user": os.environ.get("THROTTLE_AUTH_USER", "60/hour"),
        "meta_autocomplete": os.environ.get("THROTTLE_META_AUTOCOMPLETE", "120/hour"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

JWT_ACCESS_COOKIE_NAME = os.environ.get("JWT_ACCESS_COOKIE_NAME", "skillmesh_access")
JWT_REFRESH_COOKIE_NAME = os.environ.get("JWT_REFRESH_COOKIE_NAME", "skillmesh_refresh")
JWT_COOKIE_PATH = os.environ.get("JWT_COOKIE_PATH", "/")
JWT_COOKIE_SAMESITE = os.environ.get("JWT_COOKIE_SAMESITE", "Lax")
_jwt_cookie_secure_env = os.environ.get("JWT_COOKIE_SECURE", "").strip().lower()
JWT_COOKIE_SECURE = (
    _jwt_cookie_secure_env in ("1", "true", "yes")
    if _jwt_cookie_secure_env
    else (not DEBUG)
)
JWT_INCLUDE_TOKENS_IN_RESPONSE_BODY = os.environ.get(
    "JWT_INCLUDE_TOKENS_IN_RESPONSE_BODY",
    "true" if DEBUG else "false",
).lower() == "true"

CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        ",".join(CORS_ALLOWED_ORIGINS),
    ).split(",")
    if o.strip()
]

# Upload limits (resume / cover letter validators in serializers)
MAX_UPLOAD_SIZE_BYTES = int(os.environ.get("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))
MAX_RESUME_UPLOAD_BYTES = int(os.environ.get("MAX_RESUME_UPLOAD_BYTES", str(10 * 1024 * 1024)))
MAX_COVER_LETTER_UPLOAD_BYTES = int(os.environ.get("MAX_COVER_LETTER_UPLOAD_BYTES", str(5 * 1024 * 1024)))
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE_BYTES
FILE_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE_BYTES

CLAMAV_SCAN_ENABLED = os.environ.get("CLAMAV_SCAN_ENABLED", "false").lower() in ("1", "true", "yes")
CLAMAV_SCAN_REQUIRED = os.environ.get("CLAMAV_SCAN_REQUIRED", "false").lower() in ("1", "true", "yes")
CLAMAV_SCAN_COMMAND = os.environ.get("CLAMAV_SCAN_COMMAND", "").strip() or None
CLAMAV_SCAN_TIMEOUT_SEC = int(os.environ.get("CLAMAV_SCAN_TIMEOUT_SEC", "60"))

if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "true").lower() == "true"
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "true").lower() == "true"
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

FEATURE_FLAGS = {
    "enable_text_similarity": os.environ.get("FF_ENABLE_TEXT_SIMILARITY", "false").lower() == "true",
}

# ESCO (EU Commission) skill search — enriches /api/candidates/skills/suggest/ when the DB is sparse.
ESCO_SKILLS_ENABLED = os.environ.get("ESCO_SKILLS_ENABLED", "true").lower() in ("1", "true", "yes")
ESCO_SKILLS_TIMEOUT_SEC = float(os.environ.get("ESCO_SKILLS_TIMEOUT_SEC", "3"))
ESCO_SKILLS_FETCH_LIMIT = int(os.environ.get("ESCO_SKILLS_FETCH_LIMIT", "15"))