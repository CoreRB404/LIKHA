from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import migrations, models
from django.utils import timezone


def retire_email_workflows(apps, schema_editor):
    alias = schema_editor.connection.alias
    User = apps.get_model("accounts", "User")
    Grant = apps.get_model("accounts", "VerificationGrant")
    Mail = apps.get_model("accounts", "MailOutbox")
    Session = apps.get_model("sessions", "Session")
    # Existing login identifiers and password hashes are preserved by RenameField.
    # Old links and pending notifications must not survive the change.
    Grant.objects.using(alias).filter(used_at=None).update(used_at=timezone.now())
    Mail.objects.using(alias).update(encrypted_payload="", sent_at=timezone.now())
    User.objects.using(alias).update(auth_version=models.F("auth_version") + 1)
    Session.objects.using(alias).all().delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial"), ("sessions", "0001_initial")]
    operations = [
        migrations.RenameField(model_name="user", old_name="email", new_name="username"),
        migrations.AlterField(model_name="user", name="username", field=models.CharField(max_length=254, unique=True, validators=[UnicodeUsernameValidator()])),
        migrations.RunPython(retire_email_workflows, migrations.RunPython.noop),
        migrations.RemoveField(model_name="user", name="verified_at"),
    ]
