import time

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import IntegrityError, transaction
from django.db.models import F
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_safe

from core.transactions import account_transaction
from core.http import APIError, api, data, fields_only, text
from .models import Profile, User
from .services import audit, client_ip, throttle


def profile_data(user):
    profile, _ = Profile.objects.get_or_create(user=user)
    return {"id": str(user.pk), "username": user.username, "display_name": profile.display_name, "avatar": profile.avatar, "version": profile.version}


@api(authenticated=False)
def session(request):
    return {"csrf": get_token(request), "authenticated": request.user.is_authenticated, "profile": profile_data(request.user) if request.user.is_authenticated else None, "environment": settings.ENVIRONMENT}


@api(("POST",), authenticated=False)
def signup(request):
    value = data(request)
    fields_only(value, ["username", "password", "confirmation", "display_name", "notice_version"])
    throttle("signup", client_ip(request), 5, 3600)
    username = text(value, "username", 3, 254).lower()
    UnicodeUsernameValidator()(username)
    name = text(value, "display_name", 1, 60)
    password = value.get("password", "")
    if not isinstance(password, str) or password != value.get("confirmation"):
        raise APIError("Passwords must match.")
    candidate = User(username=username, notice_version="")
    validate_password(password, candidate)
    # Hash before beginning a SQLite write transaction, including duplicate requests.
    candidate.set_password(password)
    try:
        with transaction.atomic():
            candidate.save()
            Profile.objects.filter(user=candidate).update(display_name=name)
    except IntegrityError:
        raise APIError("That username is unavailable. Choose another username.", 409, "username_unavailable")
    audit(request, "signup", "accepted")
    return JsonResponse({"data": {"message": "Account created. You can sign in now."}}, status=202)


@api(("POST",), authenticated=False)
def sign_in(request):
    value = data(request)
    fields_only(value, ["username", "password"])
    username = text(value, "username", 3, 254).lower()
    password = value.get("password", "")
    if not isinstance(password, str) or len(password) > 128:
        raise APIError("Invalid sign-in details.", 401)
    throttle("login-ip", client_ip(request), 30, 900)
    throttle("login-account", username, 5, 900)
    user = authenticate(request, username=username, password=password)
    if not user:
        audit(request, "login", "failed")
        raise APIError("Invalid username or password.", 401, "login_failed")
    login(request, user)
    request.session.update({"auth_started": int(time.time()), "last_seen": int(time.time()), "auth_version": user.auth_version})
    audit(request, "login")
    return {"profile": profile_data(user), "csrf": get_token(request)}


@api(("POST",), authenticated=False)
def sign_out(request):
    audit(request, "logout")
    logout(request)
    return {"message": "Signed out."}


def reauthenticate(request, value):
    password = value.get("password", "")
    throttle("reauth", str(request.user.pk), 5, 900)
    if not isinstance(password, str) or len(password) > 128 or not request.user.check_password(password):
        raise APIError("Please confirm your current password.", 403, "reauthenticate")


@api(("POST",))
def change_password(request):
    value = data(request)
    fields_only(value, ["password", "new_password", "confirmation"])
    reauthenticate(request, value)
    password = value.get("new_password", "")
    if not isinstance(password, str) or password != value.get("confirmation"):
        raise APIError("New passwords must match.")
    validate_password(password, request.user)
    encoded = User()
    encoded.set_password(password)
    with transaction.atomic():
        User.objects.filter(pk=request.user.pk).update(password=encoded.password, auth_version=F("auth_version") + 1)
        audit(request, "password_changed")
    logout(request)
    return {"message": "Password changed. Sign in again on your devices."}


@api(("GET", "PATCH", "DELETE"))
def me(request):
    if request.method == "GET":
        return {"profile": profile_data(request.user)}
    value = data(request)
    if request.method == "DELETE":
        from learning.services import delete_account
        reauthenticate(request, value)
        if value.get("confirmation") != "DELETE":
            raise APIError("Type DELETE to confirm account deletion.")
        delete_account(request.user)
        logout(request)
        return {"message": "Your account and live artwork have been deleted. Backups expire within 30 days."}
    fields_only(value, ["display_name", "avatar", "pet_species", "pet_name", "version"])
    with account_transaction(request.user):
        profile = request.user.profile
        profile.refresh_from_db()
        if value.get("version") != profile.version:
            raise APIError("Your settings changed on another device. Reload before saving.", 409, "conflict")
        if "display_name" in value:
            profile.display_name = text(value, "display_name", 1, 60)
        if "avatar" in value:
            if type(value["avatar"]) is not int or value["avatar"] not in range(1, 7):
                raise APIError("Choose an available avatar.")
            profile.avatar = value["avatar"]
        pet = request.user.petstate
        if "pet_species" in value:
            if value["pet_species"] not in [x[0] for x in pet._meta.get_field("species").choices]:
                raise APIError("Choose an available pet.")
            pet.species = value["pet_species"]
        if "pet_name" in value:
            pet.name = text(value, "pet_name", 1, 20)
        pet.save()
        profile.version += 1
        profile.save()
    audit(request, "profile_updated")
    return {"profile": profile_data(request.user)}


@ensure_csrf_cookie
@require_safe
def account_page(request, page="login"):
    if page not in {"login", "signup"}:
        from django.http import Http404
        raise Http404
    return render(request, "accounts.html", {"page": page})
