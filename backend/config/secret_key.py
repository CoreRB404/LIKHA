"""Accept Render's 256-bit generated secret without relaxing Django's key length."""
import base64
import binascii
import hashlib


def normalize_secret(value, on_render=False):
    # Render generates 32 random bytes encoded as 44 Base64 characters. Derive
    # a stable, domain-separated Django key with the same 256 bits of entropy.
    # Do not pad or hash arbitrary short passwords into apparently strong keys.
    if on_render and len(value) == 44:
        try:
            decoded = base64.b64decode(value, validate=True)
            if len(decoded) == 32 and base64.b64encode(decoded).decode("ascii") == value:
                return hashlib.sha512(b"LIKHA Django signing key v1\0" + decoded).hexdigest()
        except (ValueError, binascii.Error):
            pass
    return value
