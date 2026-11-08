import io
import json
import zipfile
import hashlib

from django.conf import settings
from django.db import transaction
from django.http import FileResponse, HttpResponse
from django.utils import timezone

from accounts.services import audit, throttle
from accounts.views import profile_data, reauthenticate
from core.transactions import account_transaction
from .storage import read_image
from core.http import APIError, api, data, fields_only, text
from .catalog import CHALLENGES, LABS
from .models import ActivityCompletion, Artwork, QuizAttempt, QuizDefinition
from .services import artwork_data, image_path, progress, public_attempt, remove_artwork, save_artwork, start_attempt, submit_attempt


def owned_art(request, art_id, pending=False):
    art = Artwork.objects.filter(pk=art_id, owner=request.user, status__in=["ready", "pending"] if pending else ["ready"]).first()
    if not art:
        raise APIError("Artwork not found.", 404, "not_found")
    return art


@api()
def progress_view(request):
    return {"progress": progress(request.user)}


@api()
def labs(request):
    return {"labs": LABS, "challenges": CHALLENGES}


@api(("GET", "POST"))
def artworks(request):
    if request.method == "POST":
        throttle("save", str(request.user.pk), 60, 3600)
        value = data(request)
        fields_only(value, ["title", "description", "lab", "client_id", "concepts", "challenge"])
        art = save_artwork(request.user, value, request.FILES.get("image"))
        audit(request, "artwork_saved", target=art.pk)
        return {"artwork": artwork_data(art), "progress": progress(request.user)}
    try:
        limit = max(1, min(int(request.GET.get("limit", 20)), 100))
        cursor = max(0, int(request.GET.get("cursor", 0)))
    except ValueError:
        raise APIError("Invalid page request.")
    query = Artwork.objects.filter(owner=request.user, status="ready").order_by("-created_at", "id")
    lab = request.GET.get("lab")
    if lab:
        if lab not in LABS:
            raise APIError("Invalid lab filter.")
        query = query.filter(lab=lab)
    total = query.count()
    return {"artworks": [artwork_data(art) for art in query[cursor:cursor + limit]], "next_cursor": cursor + limit if cursor + limit < total else None, "total": total}


@api(("GET", "PATCH", "DELETE"))
def artwork(request, art_id):
    if request.method == "GET":
        return {"artwork": artwork_data(owned_art(request, art_id))}
    value = data(request)
    fields_only(value, ["version", "title", "description"] if request.method == "PATCH" else ["version"])
    with account_transaction(request.user):
        art = owned_art(request, art_id)
        if value.get("version") != art.version:
            raise APIError("Artwork changed on another device. Reload and try again.", 409, "conflict")
        if request.method == "DELETE":
            remove_artwork(art)
            audit(request, "artwork_deleted", target=art.pk)
            return {"message": "Artwork deleted. Previously earned progress is preserved."}
        if "title" in value:
            art.title = text(value, "title", 1, 120)
        if "description" in value:
            art.description = text(value, "description", 0, 2000)
        art.version += 1
        art.save(update_fields=["title", "description", "version", "updated_at"])
    return {"artwork": artwork_data(art)}


@api()
def artwork_image(request, art_id):
    art = owned_art(request, art_id)
    stream = io.BytesIO(read_image(art))
    response = FileResponse(stream, content_type="image/webp", as_attachment=request.GET.get("download") == "1", filename="likha-artwork.webp")
    response["X-Content-Type-Options"] = "nosniff"
    return response


@api(("POST",))
def import_artwork(request):
    throttle("import", str(request.user.pk), 60, 3600)
    value = data(request)
    fields_only(value, ["title", "description", "lab", "client_id", "concepts", "confirmed"])
    if value.pop("confirmed", "") != "yes":
        raise APIError("Confirm the artwork import into your current account.")
    art = save_artwork(request.user, value, request.FILES.get("image"), imported=True)
    audit(request, "artwork_imported", target=art.pk)
    return {"artwork": artwork_data(art), "message": "Imported without historical rewards."}


@api()
def quizzes(request):
    slug = request.GET.get("assessment", "weekly-identity")
    quiz = QuizDefinition.objects.filter(slug=slug).first()
    if not quiz:
        raise APIError("Assessment not found.", 404)
    return {"assessment": {"slug": quiz.slug, "title": quiz.title, "question_count": min(5, len(quiz.questions))}, "assessments": list(QuizDefinition.objects.values("slug", "title")), "attempts": [{"id": str(a.pk), "title": a.quiz.title, "score": a.score, "total": len(a.questions), "rewarded": a.rewarded, "date": a.submitted_at.isoformat()} for a in QuizAttempt.objects.filter(owner=request.user, submitted_at__isnull=False).select_related("quiz").order_by("-submitted_at")[:20]]}


@api(("POST",))
def attempts(request):
    value = data(request)
    fields_only(value, ["client_id", "assessment"])
    throttle("attempts", str(request.user.pk), 30, 3600)
    return {"attempt": public_attempt(start_attempt(request.user, value))}


@api(("GET", "POST"))
def attempt(request, attempt_id):
    current = QuizAttempt.objects.filter(owner=request.user, pk=attempt_id).select_related("quiz").first()
    if not current:
        raise APIError("Assessment attempt not found.", 404)
    if request.method == "POST":
        value = data(request)
        fields_only(value, ["answers"])
        current = submit_attempt(current, value)
        audit(request, "quiz_submitted", target=current.pk)
    return {"attempt": public_attempt(current), "progress": progress(request.user)}


@api(("POST",))
def complete_challenge(request, challenge_id):
    value = data(request)
    fields_only(value, ["artwork_id"])
    challenge = CHALLENGES.get(challenge_id)
    if not challenge:
        raise APIError("Challenge not found.", 404)
    try:
        art = owned_art(request, value.get("artwork_id"))
    except (ValueError, TypeError):
        raise APIError("Choose your saved challenge artwork.")
    if art.lab != challenge["lab"] or art.challenge != challenge_id or art.imported:
        raise APIError("Save a new artwork from this challenge's link first.")
    with transaction.atomic():
        ActivityCompletion.objects.get_or_create(owner=request.user, kind="challenge", source=challenge_id)
    # The artwork already earns its ordinary rewards; do not invent another challenge payout.
    audit(request, "challenge_completed", target=challenge_id)
    return {"message": "Challenge completed. Its artwork already counts toward your learning progress.", "progress": progress(request.user)}


@api(("POST",))
def export_account(request):
    reauthenticate(request, data(request))
    throttle("export", str(request.user.pk), 3, 3600)
    # Account quota bounds the archive; streamed production upgrade can replace this adapter.
    buffer = io.BytesIO()
    records = list(Artwork.objects.filter(owner=request.user, status="ready"))
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("account.json", json.dumps({"profile": profile_data(request.user), "progress": progress(request.user), "artworks": [artwork_data(a) for a in records]}, default=str))
        for art in records:
            archive.writestr(f"artworks/{art.pk}.webp", read_image(art))
    buffer.seek(0)
    audit(request, "account_export")
    return FileResponse(buffer, as_attachment=True, filename="likha-private-export.zip", content_type="application/zip")
