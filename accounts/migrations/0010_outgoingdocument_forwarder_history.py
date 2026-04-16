from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_officedepartment_can_mark_complete'),
    ]

    operations = [
        migrations.AddField(
            model_name='outgoingdocument',
            name='forwarder_history',
            field=models.TextField(blank=True),
        ),
    ]
