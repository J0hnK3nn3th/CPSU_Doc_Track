from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_rename_system_config_primary_keys'),
    ]

    operations = [
        migrations.AlterField(
            model_name='documenttype',
            name='code',
            field=models.CharField(max_length=50),
        ),
        migrations.AlterField(
            model_name='officedepartment',
            name='code',
            field=models.CharField(max_length=50),
        ),
    ]
