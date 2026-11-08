import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from learning.catalog import ASSESSMENTS
from learning.models import QuizDefinition


class Command(BaseCommand):
    help = "Idempotently publish LIKHA's versioned private assessment bank."

    def handle(self, **options):
        bank = json.loads((Path(__file__).resolve().parents[2] / "questions.json").read_text(encoding="utf-8"))
        with transaction.atomic():
            for slug, (title, categories) in ASSESSMENTS.items():
                questions = [q for q in bank if categories is None or q["category"] in categories]
                if len(questions) < 5:
                    raise CommandError(f"Assessment {slug} needs at least five questions.")
                existing = QuizDefinition.objects.filter(slug=slug).first()
                if existing and existing.questions != questions:
                    existing.version += 1
                    existing.title, existing.questions = title, questions
                    existing.save()
                elif not existing:
                    QuizDefinition.objects.create(slug=slug, title=title, questions=questions)
        self.stdout.write(self.style.SUCCESS("Seven assessment definitions seeded; answer keys remain private."))
