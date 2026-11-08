import hashlib
import io
import json
import os
import random
import uuid
import warnings
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from PIL import Image, UnidentifiedImageError

from accounts.models import DeletionRecord
from core.http import APIError, identifier, text
from core.transactions import account_transaction
from . import storage
from .catalog import CHALLENGES, LABS
from .models import ActivityCompletion, Artwork, ArtworkImport, QuizAttempt, QuizDefinition, QuizRewardClaim, RewardEvent, Wallet


def award(owner, key, stars=0, growth=0):
    """Call inside an account transaction; unique ledger event is the authority."""
    _, created = RewardEvent.objects.get_or_create(owner=owner, key=key, defaults={"stars": stars, "growth": growth})
    if created:
        wallet, _ = Wallet.objects.get_or_create(owner=owner)
        Wallet.objects.filter(pk=wallet.pk).update(stars=F("stars") + stars, lifetime=F("lifetime") + stars, growth=F("growth") + growth)


def progress(owner):
    wallet, _ = Wallet.objects.get_or_create(owner=owner)
    stage = "grown" if wallet.growth >= 16 else "young" if wallet.growth >= 10 else "growing" if wallet.growth >= 4 else "baby"
    return {"stars": wallet.stars, "lifetime_stars": wallet.lifetime, "growth_units": wallet.growth, "stage": stage, "artwork_count": Artwork.objects.filter(owner=owner, status="ready").count(), "completed_artworks": ActivityCompletion.objects.filter(owner=owner, kind="artwork").count(), "completed_challenges": list(ActivityCompletion.objects.filter(owner=owner, kind="challenge").values_list("source", flat=True)), "pet": {"species": owner.petstate.species, "name": owner.petstate.name}, "recent_rewards": list(RewardEvent.objects.filter(owner=owner).order_by("-created_at").values("key", "stars", "growth", "created_at")[:20]), "artwork_daily_limit": settings.ARTWORK_REWARD_DAILY_LIMIT}


def artwork_data(art):
    return {"id": str(art.pk), "title": art.title, "description": art.description, "lab": art.lab, "concepts": art.concepts, "image_url": f"/api/v1/artworks/{art.pk}/image", "version": art.version, "created_at": art.created_at.isoformat(), "imported": art.imported, "challenge": art.challenge, "status": art.status}


def image_path(art):
    candidate = settings.PRIVATE_MEDIA_ROOT / art.file_key
    path = candidate.resolve()
    if not path.is_relative_to(settings.PRIVATE_MEDIA_ROOT.resolve()) or candidate.is_symlink():
        raise APIError("Image unavailable.", 404)
    return path


def write_staged_image(path, encoded):
    try:
        with path.open("xb") as stream:
            stream.write(encoded)
            stream.flush()
            os.fsync(stream.fileno())
    except OSError:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass  # The reconciler handles an inaccessible orphan after storage recovers.
        raise


def decode_upload(upload):
    if not upload or upload.size > 5 * 1024 * 1024:
        raise APIError("Choose a PNG or WebP image up to 5 MiB.", 413)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            raw = upload.read(5 * 1024 * 1024 + 1)
            if len(raw) > 5 * 1024 * 1024:
                raise APIError("Image exceeds 5 MiB.", 413)
            image = Image.open(io.BytesIO(raw))
            if image.format not in {"PNG", "WEBP"} or getattr(image, "is_animated", False):
                raise APIError("Only still PNG and WebP artwork is supported.")
            width, height = image.size
            if width > 2048 or height > 2048 or width * height > 4_000_000:
                raise APIError("Image dimensions exceed 2048px or 4 megapixels.")
            image.load()
            clean = Image.new("RGBA", image.size)
            clean.paste(image.convert("RGBA"))
            output = io.BytesIO()
            clean.save(output, format="WEBP", lossless=True, method=4)
            encoded = output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise APIError("The image could not be decoded safely.")
    if len(encoded) > 5 * 1024 * 1024:
        raise APIError("Re-encoded image exceeds the storage limit.", 413)
    return encoded, width, height


def ready_artwork(art):
    """Recoverable finalize: an existing pending file can be completed after restart."""
    if storage.remote():
        storage.read_image(art)
    else:
        finalize_local_image(art)
    return complete_artwork(art)


def finalize_local_image(art):
    destination = image_path(art)
    staged = destination.with_suffix(".pending")
    if staged.exists():
        try:
            os.replace(staged, destination)
        except FileNotFoundError:
            if not destination.exists():
                raise
    if not destination.is_file():
        raise APIError("Save is pending. Retry using the same save identifier.", 503, "pending")


def complete_artwork(art):
    with account_transaction(art.owner):
        art.refresh_from_db()
        if art.status == "pending":
            art.status = "ready"
            art.save(update_fields=["status", "updated_at"])
            if not art.imported:
                now = timezone.localtime()
                today_count = ActivityCompletion.objects.filter(owner=art.owner, kind="artwork", created_at__date=now.date()).count()
                duplicate = Artwork.objects.filter(owner=art.owner, image_hash=art.image_hash, imported=False).exclude(pk=art.pk).exists()
                # Preserve visible saves but prevent identical-image and unbounded reward farming.
                if not duplicate and today_count < settings.ARTWORK_REWARD_DAILY_LIMIT:
                    ActivityCompletion.objects.get_or_create(owner=art.owner, kind="artwork", source=str(art.pk))
                    award(art.owner, f"artwork:{art.pk}:created", 15, 2)
                    total = ActivityCompletion.objects.filter(owner=art.owner, kind="artwork").count()
                    if total == 1:
                        award(art.owner, "milestone:artwork:first", 5)
                    if total == 4:
                        award(art.owner, "milestone:artwork:fourth", 10)
    return art


def save_artwork(owner, value, upload, imported=False):
    title = text(value, "title", 1, 120)
    description = text(value, "description", 0, 2000)
    lab = value.get("lab", "")
    if not isinstance(lab, str) or lab not in LABS:
        raise APIError("Choose a valid creative lab.")
    client_id = identifier(value.get("client_id"))
    concepts = value.get("concepts", {})
    if isinstance(concepts, str):
        try:
            concepts = json.loads(concepts)
        except ValueError:
            raise APIError("Invalid artistic concepts.")
    if not isinstance(concepts, dict) or set(concepts) - {"subject", "theme", "form", "style", "symbolism", "medium"} or any(not isinstance(v, str) or len(v) > 300 for v in concepts.values()):
        raise APIError("Artistic concepts must contain text up to 300 characters per field.")
    challenge = value.get("challenge", "")
    if not isinstance(challenge, str) or challenge and (challenge not in CHALLENGES or CHALLENGES[challenge]["lab"] != lab):
        raise APIError("Challenge does not belong to this lab.")
    encoded, width, height = decode_upload(upload)
    image_hash = hashlib.sha256(encoded).hexdigest()
    payload_hash = hashlib.sha256(json.dumps([title, description, lab, concepts, image_hash, imported, challenge], sort_keys=True).encode()).hexdigest()
    with account_transaction(owner):
        art = Artwork.objects.filter(owner=owner, client_id=client_id).first()
        if art:
            if art.payload_hash != payload_hash:
                raise APIError("This save identifier was already used for different artwork.", 409, "conflict")
            if art.status == "deleted":
                raise APIError("This artwork was deleted; the original save cannot be replayed.", 409, "deleted")
        else:
            if imported:
                prior = ArtworkImport.objects.filter(owner=owner, fingerprint=payload_hash).select_related("artwork").first()
                if prior:
                    return prior.artwork
            total = Artwork.objects.filter(owner=owner).exclude(status="deleted").aggregate(total=Sum("size"))["total"] or 0
            if total + len(encoded) > settings.ARTWORK_QUOTA_BYTES:
                raise APIError("Your 100 MiB artwork storage is full. Delete artwork before saving more.", 413, "quota")
            art = Artwork.objects.create(owner=owner, client_id=client_id, payload_hash=payload_hash, title=title, description=description, lab=lab, concepts=concepts, image_hash=image_hash, width=width, height=height, size=len(encoded), file_key=f"{uuid.uuid4()}.webp", imported=imported, challenge=challenge)
            if not storage.remote():
                write_staged_image(image_path(art).with_suffix(".pending"), encoded)
            if imported:
                ArtworkImport.objects.create(owner=owner, fingerprint=payload_hash, artwork=art)
    if art.status == "pending":
        if storage.remote():
            # Commit intent first; a timeout/restart leaves a retryable pending row.
            # Serialize upload with deletion to prevent resurrecting deleted media.
            with account_transaction(owner):
                art.refresh_from_db()
                if art.status == "deleted":
                    raise APIError("Artwork was deleted.", 409, "deleted")
                if art.status == "pending":
                    storage.put_image(art, encoded)
                    return ready_artwork(art)
        else:
            return ready_artwork(art)
    return art


def remove_artwork(art):
    if storage.remote():
        with account_transaction(art.owner):
            storage.delete_image(art)
            Artwork.objects.filter(pk=art.pk).update(status="deleted", size=0, version=F("version") + 1)
        return
    path = image_path(art)
    with transaction.atomic():
        Artwork.objects.filter(pk=art.pk).update(status="deleted", size=0, version=F("version") + 1)
        transaction.on_commit(lambda: path.unlink(missing_ok=True))
        transaction.on_commit(lambda: path.with_suffix(".pending").unlink(missing_ok=True))


def delete_account(owner):
    if storage.remote():
        with account_transaction(owner):
            artworks = list(Artwork.objects.filter(owner=owner))
            storage.record_deletion(owner, [art.file_key for art in artworks])
            for art in artworks:
                storage.delete_image(art)
            DeletionRecord.objects.get_or_create(user_id=owner.pk)
            owner.delete()
        return
    paths = [image_path(art) for art in Artwork.objects.filter(owner=owner)]
    # Append-only deletion journal survives restoration of an earlier database.
    journal = settings.DATA_DIR / "deletions.jsonl"
    with journal.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps({"user_id": str(owner.pk), "deleted_at": timezone.now().isoformat()}) + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    with transaction.atomic():
        DeletionRecord.objects.get_or_create(user_id=owner.pk)
        owner.delete()
    for path in paths:
        path.unlink(missing_ok=True)
        path.with_suffix(".pending").unlink(missing_ok=True)


def week_window():
    year, week, _ = timezone.localtime().isocalendar()
    return f"{year}-W{week:02d}"


def public_attempt(attempt):
    result = {"id": str(attempt.pk), "title": attempt.quiz.title, "window": attempt.window, "submitted": bool(attempt.submitted_at), "questions": [{"id": q["id"], "question": q["question"], "category": q["category"], "options": [{"id": q["option_ids"][i], "text": q["options"][i]} for i in q["order"]]} for q in attempt.questions]}
    if attempt.submitted_at:
        result.update(score=attempt.score, total=len(attempt.questions), rewarded=attempt.rewarded, feedback=[{"id": q["id"], "answer": q["option_ids"][q["answer"]], "explanation": q["explanation"]} for q in attempt.questions])
    return result


def start_attempt(owner, value):
    client_id = identifier(value.get("client_id"))
    quiz = QuizDefinition.objects.filter(slug=value.get("assessment", "weekly-identity")).first()
    if not quiz:
        raise APIError("Assessment not found.", 404)
    questions = random.SystemRandom().sample(quiz.questions, min(5, len(quiz.questions)))
    for q in questions:
        q["order"] = random.SystemRandom().sample(range(len(q["options"])), len(q["options"]))
        q["option_ids"] = [uuid.uuid4().hex for _ in q["options"]]
    with account_transaction(owner):
        attempt, _ = QuizAttempt.objects.get_or_create(owner=owner, client_id=client_id, defaults={"quiz": quiz, "quiz_version": quiz.version, "window": week_window(), "questions": questions})
        if attempt.quiz_id != quiz.pk:
            raise APIError("Attempt identifier already used.", 409)
    return attempt


def submit_attempt(attempt, value):
    answers = value.get("answers")
    if not isinstance(answers, dict) or set(answers) != {q["id"] for q in attempt.questions}:
        raise APIError("Answer each question in this assessment.")
    for question in attempt.questions:
        answer = answers[question["id"]]
        if not isinstance(answer, str) or answer not in question["option_ids"]:
            raise APIError("Choose a valid option for each question.")
    with account_transaction(attempt.owner):
        attempt.refresh_from_db()
        if attempt.submitted_at:
            if attempt.answers != answers:
                raise APIError("This attempt has already been submitted.", 409)
            return attempt
        attempt.answers = answers
        attempt.score = sum(answers[q["id"]] == q["option_ids"][q["answer"]] for q in attempt.questions)
        attempt.submitted_at = timezone.now()
        eligible = attempt.window == week_window()
        if eligible:
            _, claimed = QuizRewardClaim.objects.get_or_create(owner=attempt.owner, quiz=attempt.quiz, window=attempt.window, defaults={"attempt": attempt})
            attempt.rewarded = claimed
            if claimed:
                ActivityCompletion.objects.get_or_create(owner=attempt.owner, kind="quiz", source=attempt.quiz.slug, window=attempt.window)
                award(attempt.owner, f"quiz:{attempt.quiz_id}:{attempt.window}:eligible", attempt.score * 10, attempt.score * 2 + 2)
        attempt.save()
    return attempt
