from django.conf import settings
from django.db import models


class DocumentType(models.Model):
    document_type_id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']


class OfficeDepartment(models.Model):
    office_department_id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=150)
    head = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']


class UserRoleConfig(models.Model):
    user_role_id = models.BigAutoField(primary_key=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    name_extension = models.CharField(max_length=20, blank=True)
    office_department = models.CharField(max_length=150)
    position_role = models.CharField(max_length=150)
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['username']


class OutgoingDocument(models.Model):
    control_number = models.CharField(
        max_length=9,
        unique=True,
        null=True,
        blank=True,
        help_text='Format: four digits, hyphen, four digits (e.g. 8656-8664).',
    )
    document_code = models.CharField(max_length=100)
    document_state = models.CharField(max_length=50, default='NEW')
    category = models.CharField(max_length=200, blank=True)
    subject = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    prepared_by = models.CharField(max_length=300, blank=True)
    recipient_name = models.CharField(max_length=300, blank=True)
    recipient_department = models.CharField(max_length=200, blank=True)
    carrier = models.CharField(max_length=200, blank=True)
    remarks = models.TextField(blank=True)
    office_name = models.CharField(max_length=200, blank=True)
    received_by = models.CharField(max_length=300, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='outgoing_documents',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
