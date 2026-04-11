from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0010_job_draft_blank_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobposting",
            name="whats_on_offer",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="what_we_are_looking_for",
            field=models.TextField(blank=True, help_text="Ideal candidate profile, qualities, and must-haves."),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="the_role",
            field=models.TextField(blank=True, help_text="Day-to-day responsibilities, scope, and expectations."),
        ),
        migrations.AddField(
            model_name="jobposting",
            name="how_to_apply",
            field=models.TextField(blank=True, help_text="Application steps, documents to include, and timeline."),
        ),
        migrations.AlterField(
            model_name="jobposting",
            name="jd_text",
            field=models.TextField(
                blank=True,
                help_text="Opening summary: context, team, and why the role exists.",
            ),
        ),
    ]
