from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_outgoingdocument_control_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='officedepartment',
            name='can_mark_complete',
            field=models.BooleanField(default=False),
        ),
    ]
