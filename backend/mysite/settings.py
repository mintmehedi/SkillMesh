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

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "127.0.0.1,localhost,.vercel.app").split(",")
    if h.strip()
]


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
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
}

CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

FEATURE_FLAGS = {
    "enable_text_similarity": os.environ.get("FF_ENABLE_TEXT_SIMILARITY", "false").lower() == "true",
}

# ESCO (EU Commission) skill search — enriches /api/candidates/skills/suggest/ when the DB is sparse.
ESCO_SKILLS_ENABLED = os.environ.get("ESCO_SKILLS_ENABLED", "true").lower() in ("1", "true", "yes")
ESCO_SKILLS_TIMEOUT_SEC = float(os.environ.get("ESCO_SKILLS_TIMEOUT_SEC", "3"))
ESCO_SKILLS_FETCH_LIMIT = int(os.environ.get("ESCO_SKILLS_FETCH_LIMIT", "15"))