from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponse, HttpResponsePermanentRedirect, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_safe

from accounts.views import profile_data
from learning.catalog import CHALLENGES, LABS

PAGE_NAMES = ("dashboard", "studio", "gallery", "avatar", "pet", "quiz", "settings")
LEGACY_TARGETS = {**{name: "/" + name + "/" for name in PAGE_NAMES}, "index": "/", "challenges": "/dashboard/#dailyChallenge", "grow-a-pet": "/pet/", "weekly-quiz": "/quiz/"}


@ensure_csrf_cookie
@require_safe
def home(request):
    if request.user.is_authenticated:
        return redirect("dashboard")
    return render(request, "legacy/index.html")


@ensure_csrf_cookie
@login_required
@require_safe
def page(request, name):
    if name not in {"dashboard", "studio", "gallery", "avatar", "pet", "quiz", "settings"}:
        raise Http404
    context = {"page": name, "profile": profile_data(request.user), "labs": LABS, "challenges": CHALLENGES}
    return render(request, f"legacy/{name}.html" if name != "settings" else "settings.html", context)


def health(request, ready=False):
    if ready:
        import hmac
        if not settings.HEALTH_TOKEN or not hmac.compare_digest(request.headers.get("X-Health-Token", ""), settings.HEALTH_TOKEN):
            raise Http404
        from django.db import connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT COUNT(*) FROM django_migrations")
            from learning.storage import remote, check_bucket
            if remote():
                check_bucket()
            elif not settings.PRIVATE_MEDIA_ROOT.is_dir():
                raise OSError
        except Exception:
            return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})


def error_page(request, exception=None, status=404):
    if request.path.startswith("/api/"):
        from .http import error_response
        return error_response(request, "Not found." if status == 404 else "Request could not be completed.", status)
    return render(request, "error.html", {"status": status}, status=status)


@require_safe
def legacy_redirect(request, target):
    # Targets are fixed by URL configuration, never supplied by a query value.
    base, separator, fragment = target.partition("#")
    query = request.GET.urlencode()
    destination = base + ("?" + query if query else "") + ("#" + fragment if separator else "")
    return HttpResponsePermanentRedirect(destination)


@require_safe
def legacy_page(request, name):
    if name not in PAGE_NAMES:
        raise Http404
    return legacy_redirect(request, LEGACY_TARGETS[name])


@require_safe
def vscode_redirect(request, name):
    if name not in LEGACY_TARGETS:
        raise Http404
    return legacy_redirect(request, LEGACY_TARGETS[name])
