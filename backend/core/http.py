import json
import uuid
import errno
from functools import wraps

from django.core.exceptions import ValidationError
from django.db import DatabaseError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie


class APIError(Exception):
    def __init__(self, message, status=422, code="invalid", fields=None):
        self.message, self.status, self.code, self.fields = message, status, code, fields or {}


def error_response(request, message, status=422, code="invalid", fields=None):
    return JsonResponse({"error": {"code": code, "message": message, "fields": fields or {}, "request_id": getattr(request, "request_id", "")}}, status=status)


def csrf_failure(request, reason=""):
    return error_response(request, "This form expired. Refresh and try again.", 403, "csrf")


def data(request):
    if request.content_type == "application/json":
        if len(request.body) > 64 * 1024:
            raise APIError("Request too large.", 413)
        try:
            def unique_object(pairs):
                result=dict(pairs)
                if len(result)!=len(pairs):
                    raise ValueError("Duplicate JSON fields")
                return result
            def invalid_constant(value):
                raise ValueError("Non-finite JSON value")
            value = json.loads(request.body or b"{}", object_pairs_hook=unique_object, parse_constant=invalid_constant)
            def valid_text(item, depth=0):
                if depth>20:
                    raise ValueError("JSON nesting is too deep")
                if isinstance(item,str):
                    item.encode('utf-8')
                elif isinstance(item,dict):
                    for key,child in item.items():
                        valid_text(key,depth+1)
                        valid_text(child,depth+1)
                elif isinstance(item,list):
                    for child in item:
                        valid_text(child,depth+1)
            valid_text(value)
        except (ValueError, UnicodeError, RecursionError):
            raise APIError("Invalid JSON.")
        if not isinstance(value, dict):
            raise APIError("Expected a JSON object.")
        return value
    return request.POST.dict()


def fields_only(value, allowed):
    if set(value) - set(allowed):
        raise APIError("The request contains unsupported fields.")


def text(value, name, minimum=0, maximum=120):
    result = value.get(name, "")
    if not isinstance(result, str) or not minimum <= len(result.strip()) <= maximum:
        raise APIError(f"{name.replace('_', ' ').capitalize()} must be {minimum}–{maximum} characters.")
    return result.strip()


def identifier(value):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise APIError("A valid save/attempt identifier is required.")


def api(methods=("GET",), authenticated=True):
    def decorate(view):
        @wraps(view)
        @ensure_csrf_cookie
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                response = error_response(request, "Method not allowed.", 405, "method")
                response["Allow"] = ", ".join(methods)
                return response
            if authenticated and not request.user.is_authenticated:
                return error_response(request, "Please sign in to your account.", 401, "login_required")
            expected = request.headers.get("X-Likha-Account")
            if expected and (not request.user.is_authenticated or str(request.user.pk) != expected):
                return error_response(request, "The signed-in account changed in another tab. Reload before continuing; download any unsaved drawing first.", 409, "account_changed")
            try:
                result = view(request, *args, **kwargs)
                if isinstance(result, dict):
                    return JsonResponse({"data": result})
                return result
            except APIError as error:
                response = error_response(request, error.message, error.status, error.code, error.fields)
                if error.status == 429:
                    response["Retry-After"] = "900"
                return response
            except ValidationError as error:
                return error_response(request, " ".join(error.messages))
            except DatabaseError:
                response = error_response(request, "Saving is temporarily unavailable. Your drawing is still here; retry the same save shortly.", 503, "database_unavailable")
                response["Retry-After"] = "3"
                return response
            except OSError as error:
                if error.errno not in {errno.ENOSPC, errno.EDQUOT, errno.EACCES, errno.EROFS, errno.EIO}:
                    raise
                return error_response(request, "Storage is temporarily unavailable. Keep or download your drawing and try again later.", 503, "storage_unavailable")
        return wrapped
    return decorate
