"""Matplotlib chart generation for premium employer dashboard analytics."""

from __future__ import annotations

import base64
import io
from collections import Counter
from datetime import timedelta

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from applications.models import Application
from employers.models import JobPosting

CHART_FACE = "#0f1419"
CHART_TEXT = "#e8eaed"
CHART_MUTED = "#9aa0a6"
CHART_COLORS = ["#5b8def", "#34a853", "#fbbc04", "#ea4335", "#ab47bc", "#00acc1"]


def _fig_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight", facecolor=CHART_FACE)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def _style_axes(ax):
    ax.set_facecolor(CHART_FACE)
    ax.tick_params(colors=CHART_MUTED, labelsize=9)
    ax.xaxis.label.set_color(CHART_TEXT)
    ax.yaxis.label.set_color(CHART_TEXT)
    ax.title.set_color(CHART_TEXT)
    for spine in ax.spines.values():
        spine.set_color("#2d333b")


def build_job_status_chart(job_rows=None, *, counts: Counter | None = None) -> dict | None:
    if counts is None:
        counts = Counter()
        for row in job_rows or []:
            status = (row.get("status") or "open").lower()
            counts[status] += 1
    if not counts:
        return None
    labels = list(counts.keys())
    values = [counts[k] for k in labels]
    fig, ax = plt.subplots(figsize=(5.2, 3.4))
    fig.patch.set_facecolor(CHART_FACE)
    _style_axes(ax)
    bars = ax.bar(labels, values, color=CHART_COLORS[: len(labels)])
    ax.set_title("Jobs by status")
    ax.set_ylabel("Count")
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height(), str(val), ha="center", va="bottom", color=CHART_TEXT, fontsize=9)
    return {
        "id": "jobs_by_status",
        "title": "Jobs by status",
        "image_base64": _fig_to_base64(fig),
    }


def build_application_status_chart(app_rows=None, *, counts: Counter | None = None) -> dict | None:
    if counts is None:
        counts = Counter()
        for row in app_rows or []:
            status = (row.get("status") or "applied").lower()
            counts[status] += 1
    if not counts:
        return None
    labels = list(counts.keys())
    values = [counts[k] for k in labels]
    fig, ax = plt.subplots(figsize=(5.2, 3.4))
    fig.patch.set_facecolor(CHART_FACE)
    _style_axes(ax)
    ax.barh(labels, values, color=CHART_COLORS[: len(labels)])
    ax.set_title("Applications by status")
    ax.set_xlabel("Count")
    ax.invert_yaxis()
    return {
        "id": "applications_by_status",
        "title": "Applications by status",
        "image_base64": _fig_to_base64(fig),
    }


def build_applications_timeline_chart(owner_id: int, days: int = 14) -> dict | None:
    since = timezone.now() - timedelta(days=days - 1)
    qs = (
        Application.objects.filter(job__employer_id=owner_id, created_at__gte=since)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    by_day = {row["day"]: row["count"] for row in qs if row["day"]}
    if not by_day:
        return None
    start = since.date()
    end = timezone.now().date()
    labels = []
    values = []
    cursor = start
    while cursor <= end:
        labels.append(cursor.strftime("%d %b"))
        values.append(by_day.get(cursor, 0))
        cursor += timedelta(days=1)
    fig, ax = plt.subplots(figsize=(5.6, 3.4))
    fig.patch.set_facecolor(CHART_FACE)
    _style_axes(ax)
    ax.plot(labels, values, color=CHART_COLORS[0], marker="o", linewidth=2, markersize=4)
    ax.fill_between(range(len(values)), values, alpha=0.15, color=CHART_COLORS[0])
    ax.set_title(f"Applications (last {days} days)")
    ax.set_ylabel("New applications")
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=35, ha="right")
    fig.subplots_adjust(bottom=0.28)
    return {
        "id": "applications_timeline",
        "title": f"Applications (last {days} days)",
        "image_base64": _fig_to_base64(fig),
    }


def _status_counts(qs, *, status_field: str = "status", default_status: str = "open") -> Counter:
    counts = Counter()
    for row in qs.values(status_field).annotate(total=Count("id")):
        status = (row.get(status_field) or default_status).lower()
        counts[status] += row["total"]
    return counts


def build_dashboard_charts(owner_id: int) -> tuple[list[dict], dict]:
    job_qs = JobPosting.objects.filter(employer_id=owner_id)
    app_qs = Application.objects.filter(job__employer_id=owner_id)
    job_counts = _status_counts(job_qs)
    app_counts = _status_counts(app_qs, status_field="status", default_status="applied")
    charts = []
    job_chart = build_job_status_chart(counts=job_counts)
    if job_chart:
        charts.append(job_chart)
    app_chart = build_application_status_chart(counts=app_counts)
    if app_chart:
        charts.append(app_chart)
    timeline = build_applications_timeline_chart(owner_id)
    if timeline:
        charts.append(timeline)
    since_14d = timezone.now() - timedelta(days=14)
    summary = {
        "total_jobs": job_qs.count(),
        "open_jobs": job_qs.filter(status__iexact="open").count(),
        "total_applications": app_qs.count(),
        "applications_last_14_days": app_qs.filter(created_at__gte=since_14d).count(),
    }
    return charts, summary
