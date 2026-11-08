import ipaddress
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.crypto import salted_hmac

from core.http import APIError
from .models import AuditEvent, RateBucket


def client_ip(request):
    candidate = request.META.get("REMOTE_ADDR", "")
    if settings.TRUST_PROXY:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if settings.PROXY_MODE == "render":
            # Render sets the first address to the actual client. Enable only
            # behind Render's controlled ingress, never on a public raw WSGI port.
            forwarded = forwarded.split(",", 1)[0].strip()
        try:
            # The supplied proxy overwrites this header with exactly one address.
            candidate = str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    return candidate


def audit(request, action, outcome="ok", target=""):
    AuditEvent.objects.create(actor=request.user if request.user.is_authenticated else None, action=action, outcome=outcome, target=str(target)[:100], request_id=request.request_id)


def throttle(scope, identity, limit, seconds):
    now = timezone.now()
    key = salted_hmac("likha-rate", f"{scope}:{identity}:{int(now.timestamp()) // seconds}").hexdigest()
    with transaction.atomic():
        bucket, _ = RateBucket.objects.get_or_create(key=key, defaults={"expires_at": now + timedelta(seconds=seconds)})
        RateBucket.objects.filter(pk=bucket.pk).update(count=F("count") + 1)
        bucket.refresh_from_db()
    if bucket.count > limit:
        raise APIError("Too many requests. Please try again later.", 429, "throttled")

