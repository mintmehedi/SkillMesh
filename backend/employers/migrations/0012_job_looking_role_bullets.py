from django.db import migrations, models


def text_to_bullet_lines(text):
    if text is None:
        return []
    s = str(text).strip()
    if not s:
        return []
    raw_lines = s.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    lines = [ln.strip() for ln in raw_lines if ln.strip()]
    out = []
    for ln in lines:
        while ln and ln[0] in "-*•●·":
            ln = ln[1:].strip()
        if ln.startswith("- "):
            ln = ln[2:].strip()
        if ln:
            out.append(ln[:500])
    return out if out else [s[:500]]


def forwards(apps, schema_editor):
    JobPosting = apps.get_model("employers", "JobPosting")
    for job in JobPosting.objects.all():
        legacy_look = getattr(job, "what_we_are_looking_for", "") or ""
        legacy_role = getattr(job, "the_role", "") or ""
        job.looking_for_people_bullets = text_to_bullet_lines(legacy_look)
        job.looking_for_additional_bullets = []
        job.role_bullets = text_to_bullet_lines(legacy_role)
        job.save(
            update_fields=[
                "looking_for_people_bullets",
                "looking_for_additional_bullets",
                "role_bullets",
            ]
        )


def backwards(apps, schema_editor):
    JobPosting = apps.get_model("employers", "JobPosting")
    for job in JobPosting.objects.all():
        people = getattr(job, "looking_for_people_bullets", None) or []
        role = getattr(job, "role_bullets", None) or []
        job.what_we_are_looking_for = "\n".join(str(x) for x in people) if people else ""
        job.the_role = "\n".join(str(x) for x in role) if role else ""
        job.save(update_fields=["what_we_are_looking_for", "the_role"])


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0011_job_structured_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobposting",
            name="looking_for_people_bullets",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="looking_for_additional_bullets",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="role_bullets",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name="jobposting",
            name="what_we_are_looking_for",
        ),
        migrations.RemoveField(
            model_name="jobposting",
            name="the_role",
        ),
    ]
