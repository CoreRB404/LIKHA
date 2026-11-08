import time
import uuid

from django.contrib.auth import logout
from django.http import HttpResponse

from .http import error_response


class BoundaryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = str(uuid.uuid4())
        if request.path == "/admin/login/" and request.method == "POST":
            from accounts.services import client_ip, throttle
            from .http import APIError
            try:
                throttle("staff-ip", client_ip(request), 30, 900)
                throttle("staff-account", request.POST.get("username", "").strip().lower(), 5, 900)
            except APIError:
                response = error_response(request, "Too many sign-in requests. Try again later.", 429)
                response["Retry-After"] = "900"
                return response
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        if length > 6 * 1024 * 1024:
            response = error_response(request, "Upload exceeds 5 MiB.", 413, "too_large")
        else:
            response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        response["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; "
            "connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        )
        response["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        if not request.path.startswith("/static/"):
            response["Cache-Control"] = "no-store, private"
            response["Pragma"] = "no-cache"
        return response


class SessionPolicyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            now = int(time.time())
            previous = request.session.get("last_seen", now)
            started = request.session.get("auth_started", now)
            # Admin's framework login is initialized here; public API login also sets these.
            version = request.session.get("auth_version", request.user.auth_version)
            idle = 900 if request.user.is_staff else 1800
            if version != request.user.auth_version or now - previous > idle or now - started > 43200:
                logout(request)
            elif now - previous >= 60 or "auth_started" not in request.session:
                request.session.update({"last_seen": now, "auth_started": started, "auth_version": version})
        return self.get_response(request)
