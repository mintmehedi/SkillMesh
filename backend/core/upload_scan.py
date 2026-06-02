"""Optional malware scan for uploads (ClamAV via clamscan CLI)."""

import shutil
import subprocess
import tempfile
from pathlib import Path

from django.conf import settings
from rest_framework import serializers


def scan_upload_for_malware(uploaded_file) -> None:
    """
    When CLAMAV_SCAN_ENABLED=true and clamscan is on PATH, reject infected files.
    No-op otherwise (safe default for local dev).
    """
    if not getattr(settings, "CLAMAV_SCAN_ENABLED", False):
        return

    clamscan = getattr(settings, "CLAMAV_SCAN_COMMAND", None) or shutil.which("clamscan")
    if not clamscan:
        if getattr(settings, "CLAMAV_SCAN_REQUIRED", False):
            raise serializers.ValidationError("Virus scanning is required but not available.")
        return

    uploaded_file.seek(0)
    suffix = Path(getattr(uploaded_file, "name", "") or "upload").suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        tmp.flush()
        uploaded_file.seek(0)
        try:
            proc = subprocess.run(
                [clamscan, "--no-summary", tmp.name],
                capture_output=True,
                text=True,
                timeout=getattr(settings, "CLAMAV_SCAN_TIMEOUT_SEC", 60),
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            if getattr(settings, "CLAMAV_SCAN_REQUIRED", False):
                raise serializers.ValidationError("Virus scan failed.") from exc
            return

    if proc.returncode == 1:
        raise serializers.ValidationError("File failed malware scan.")
    if proc.returncode not in (0, 1):
        if getattr(settings, "CLAMAV_SCAN_REQUIRED", False):
            raise serializers.ValidationError("Virus scan could not complete.")
