from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_outgoingdocument_forwarder_history'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('activity_log_id', models.BigAutoField(primary_key=True, serialize=False)),
                ('actor_username', models.CharField(blank=True, max_length=150)),
                ('action', models.CharField(max_length=120)),
                ('target', models.CharField(blank=True, max_length=255)),
                ('details', models.TextField(blank=True)),
                ('source', models.CharField(default='BACKEND', max_length=30)),
                ('ip_address', models.CharField(blank=True, max_length=64)),
                ('user_agent', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
