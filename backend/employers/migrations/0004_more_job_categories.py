from django.db import migrations


def add_categories(apps, schema_editor):
    JobCategory = apps.get_model("employers", "JobCategory")
    rows = [
        ("government-public", "Government & public sector", 125),
        ("trades-construction", "Trades & construction", 130),
        ("hospitality-tourism", "Hospitality & tourism", 135),
        ("retail-customer-service", "Retail & customer service", 140),
        ("science-rd", "Science & research", 145),
        ("agriculture", "Agriculture & environment", 150),
        ("media-entertainment", "Media & entertainment", 155),
        ("nonprofit", "Non-profit & community", 160),
        ("consulting", "Consulting & professional services", 165),
        ("real-estate", "Real estate & property", 170),
        ("customer-support", "Customer support & success", 175),
        ("product-management", "Product management", 180),
    ]
    for slug, name, sort_order in rows:
        JobCategory.objects.update_or_create(
            slug=slug,
            defaults={"name": name, "sort_order": sort_order},
        )


def remove_categories(apps, schema_editor):
    JobCategory = apps.get_model("employers", "JobCategory")
    slugs = [
        "government-public",
        "trades-construction",
        "hospitality-tourism",
        "retail-customer-service",
        "science-rd",
        "agriculture",
        "media-entertainment",
        "nonprofit",
        "consulting",
        "real-estate",
        "customer-support",
        "product-management",
    ]
    JobCategory.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("employers", "0003_seed_job_categories"),
    ]

    operations = [
        migrations.RunPython(add_categories, remove_categories),
    ]
