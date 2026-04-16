from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_outgoingdocument_carrier'),
    ]

    operations = [
        migrations.AddField(
            model_name='outgoingdocument',
            name='control_number',
            field=models.CharField(
                blank=True,
                help_text='Format: four digits, hyphen, four digits (e.g. 8656-8664).',
                max_length=9,
                null=True,
                unique=True,
            ),
        ),
    ]
