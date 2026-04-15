from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_outgoing_document'),
    ]

    operations = [
        migrations.RenameField(
            model_name='documenttype',
            old_name='id',
            new_name='document_type_id',
        ),
        migrations.RenameField(
            model_name='officedepartment',
            old_name='id',
            new_name='office_department_id',
        ),
        migrations.RenameField(
            model_name='userroleconfig',
            old_name='id',
            new_name='user_role_id',
        ),
    ]
