from django.core.exceptions import ValidationError
from django.conf import settings
from functools import lru_cache
import hashlib
import re
from pathlib import Path
from urllib.request import Request, urlopen


class PasswordLengthValidator:
    def validate(self, password, user=None):
        if not 8 <= len(password) <= 128:
            raise ValidationError("Use a password between 8 and 128 characters.", code="password_length")

    def get_help_text(self):
        return "Use a password with at least 8 characters (up to 128)."


@lru_cache(maxsize=4)
def load_blocklist(path):
    lines = Path(path).read_text(encoding="ascii").splitlines()
    if not lines or any(not re.fullmatch(r"[0-9A-F]{40}", line) for line in lines):
        raise ValueError("Invalid local password blocklist")
    return frozenset(lines)


class BreachedPasswordValidator:
    def validate(self, password, user=None):
        digest = hashlib.sha1(password.encode("utf-8"), usedforsecurity=False).hexdigest().upper()
        try:
            blocked = digest in load_blocklist(str(settings.PASSWORD_BLOCKLIST))
        except (OSError, ValueError, UnicodeError):
            raise ValidationError("The password safety check is temporarily unavailable. Try again shortly.", code="password_check_unavailable")
        if blocked:
            raise ValidationError("This password appears in a known weak or compromised password list. Choose a different one.", code="password_breached")
        if settings.PASSWORD_BREACH_MODE == "online":  # nosec B105
            # Only five hash characters leave the server; never the password,
            # username or complete hash. Padding limits response-size inference.
            request = Request("https://api.pwnedpasswords.com/range/" + digest[:5], headers={"Add-Padding": "true", "User-Agent": "LIKHA-password-check"})
            try:
                with urlopen(request, timeout=5) as response:  # nosec B310
                    body = response.read(2 * 1024 * 1024).decode("ascii")
                if not body.strip():
                    raise ValueError("Empty password range response")
                for line in body.splitlines():
                    if not re.fullmatch(r"[0-9A-F]{35}:[0-9]+", line.strip()):
                        raise ValueError("Invalid password range response")
                    suffix, count = line.strip().split(":")
                    if suffix == digest[5:] and int(count) > 0:
                        raise ValidationError("This password has appeared in a data breach. Choose a different one.", code="password_breached")
            except (OSError, ValueError, UnicodeError):
                raise ValidationError("The password safety check is temporarily unavailable. Try again shortly.", code="password_check_unavailable")

    def get_help_text(self):
        return "Choose a password absent from known weak or compromised password lists."
