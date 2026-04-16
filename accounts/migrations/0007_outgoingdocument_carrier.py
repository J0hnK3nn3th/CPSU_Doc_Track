from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_outgoingdocument_received_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='outgoingdocument',
            name='carrier',
            field=models.CharField(blank=True, max_length=200),
        ),
    ]
