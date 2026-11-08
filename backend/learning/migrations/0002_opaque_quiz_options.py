import uuid
from django.db import migrations


def opaque_options(apps, schema_editor):
    Attempt = apps.get_model("learning", "QuizAttempt")
    for attempt in Attempt.objects.using(schema_editor.connection.alias).all().iterator():
        changed = False
        answers = attempt.answers
        for question in attempt.questions:
            if "option_ids" not in question:
                question["option_ids"] = [uuid.uuid4().hex for _ in question["options"]]
                if answers and type(answers.get(question["id"])) is int:
                    answers[question["id"]] = question["option_ids"][answers[question["id"]]]
                changed = True
        if changed:
            attempt.answers = answers
            attempt.save(update_fields=["questions", "answers"])


class Migration(migrations.Migration):
    dependencies = [("learning", "0001_initial")]
    operations = [migrations.RunPython(opaque_options, migrations.RunPython.noop)]
