from django.conf import settings
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='OutgoingDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('document_code', models.CharField(max_length=100)),
                ('document_state', models.CharField(default='NEW', max_length=50)),
                ('category', models.CharField(blank=True, max_length=200)),
                ('subject', models.CharField(max_length=500)),
                ('description', models.TextField(blank=True)),
                ('prepared_by', models.CharField(blank=True, max_length=300)),
                ('recipient_name', models.CharField(blank=True, max_length=300)),
                ('recipient_department', models.CharField(blank=True, max_length=200)),
                ('remarks', models.TextField(blank=True)),
                ('office_name', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='outgoing_documents',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
