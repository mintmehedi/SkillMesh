from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("candidates", "0003_candidate_education"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="candidateprofile",
            name="years_experience",
        ),
        migrations.AddField(
            model_name="candidateprofile",
            name="headline",
            field=models.CharField(blank=True, max_length=180),
        ),
        migrations.AddField(
            model_name="candidateprofile",
            name="linkedin_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="candidateprofile",
            name="portfolio_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="candidateprofile",
            name="availability",
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name="resumedocument",
            name="display_name",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
