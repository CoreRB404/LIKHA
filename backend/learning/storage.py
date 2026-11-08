"""Server-only private Supabase REST adapter. No public or signed artwork URLs."""
import hashlib
import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings
from core.http import APIError

MAX_IMAGE = 5 * 1024 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the service credential to another origin.


def remote():
    return settings.MEDIA_BACKEND == "supabase"


def request(method, path, payload=None, content_type="application/json", missing_ok=False):
    headers = {"apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
               "Authorization": "Bearer " + settings.SUPABASE_SERVICE_ROLE_KEY,
               "Content-Type": content_type, "x-upsert": "true"}
    req = Request(settings.SUPABASE_URL + "/storage/v1/" + path, data=payload,
                  headers=headers, method=method)
    try:
        with build_opener(NoRedirect()).open(req, timeout=15) as response:
            result = response.read(MAX_IMAGE + 1)
            if len(result) > MAX_IMAGE:
                raise APIError("Private storage returned an invalid response.", 503, "storage_unavailable")
            return result
    except HTTPError as error:
        status = error.code
        error.close()
        if missing_ok and status == 404:
            return None
        raise APIError("Private storage is unavailable. Please retry.", 503, "storage_unavailable") from None
    except (URLError, TimeoutError, OSError):
        raise APIError("Private storage is unavailable. Please retry.", 503, "storage_unavailable") from None


def object_key(art):
    if not re.fullmatch(r"[0-9a-f-]{36}\.webp", art.file_key):
        raise APIError("Image unavailable.", 404)
    return "artworks/" + art.file_key


def put_image(art, encoded):
    request("POST", "object/" + settings.SUPABASE_STORAGE_BUCKET + "/" + object_key(art), encoded, "image/webp")


def read_image(art):
    if remote():
        result = request("GET", "object/authenticated/" + settings.SUPABASE_STORAGE_BUCKET + "/" + object_key(art), missing_ok=True)
        if result is None:
            raise APIError("Artwork image unavailable.", 404, "not_found")
    else:
        from .services import image_path
        path = image_path(art)
        if not path.is_file():
            raise APIError("Artwork image unavailable.", 404, "not_found")
        with path.open("rb") as stream:
            result = stream.read(MAX_IMAGE + 1)
    if len(result) > MAX_IMAGE or hashlib.sha256(result).hexdigest() != art.image_hash:
        raise APIError("Artwork image failed its integrity check.", 404, "image_integrity")
    return result


def delete_image(art):
    request("DELETE", "object/" + settings.SUPABASE_STORAGE_BUCKET,
            json.dumps({"prefixes": [object_key(art)]}).encode())


def record_deletion(owner, keys):
    # Separate immutable identity survives a database-only restore. Keep with backups.
    payload = json.dumps({"user_id": str(owner.pk), "file_keys": keys}).encode()
    request("POST", "object/" + settings.SUPABASE_STORAGE_BUCKET + "/deletions/" + str(owner.pk) + ".json", payload)


def check_bucket():
    try:
        metadata = json.loads(request("GET", "bucket/" + settings.SUPABASE_STORAGE_BUCKET))
        if metadata.get("public") is not False:
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        raise APIError("The artwork bucket must be private.", 503, "storage_configuration") from None
