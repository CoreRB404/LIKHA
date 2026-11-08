from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie

from accounts.views import profile_data
from learning.catalog import CHALLENGES, LABS


@ensure_csrf_cookie
def home(request):
    if request.user.is_authenticated:
        return redirect("/dashboard.html")
    return render(request, "home.html")


@ensure_csrf_cookie
@login_required
def page(request, name):
    if name not in {"dashboard", "studio", "gallery", "avatar", "pet", "quiz", "settings"}:
        raise Http404
    context = {"page": name, "profile": profile_data(request.user), "labs": LABS, "challenges": CHALLENGES}
    return render(request, f"legacy/{name}.html" if name in {"studio", "gallery", "avatar", "pet", "quiz"} else f"{name}.html", context)


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


def legacy_redirect(request, target):
    return redirect(target)


def vscode_redirect(request, name):
    allowed = {"index", "dashboard", "studio", "gallery", "avatar", "pet", "quiz", "challenges", "grow-a-pet", "weekly-quiz"}
    if name not in allowed:
        raise Http404
    target = "/" if name == "index" else f"/{name}.html"
    query = request.GET.urlencode()
    return redirect(target + ("?" + query if query else ""))
