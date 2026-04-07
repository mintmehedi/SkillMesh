from rest_framework import serializers

from .models import Application


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ("id", "candidate", "job", "status", "created_at")
        read_only_fields = ("candidate", "created_at")
