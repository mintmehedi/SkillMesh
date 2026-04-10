import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mysite.settings")

from mysite.wsgi import application  # noqa: E402

