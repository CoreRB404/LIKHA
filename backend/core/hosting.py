"""Only for a server reached through the controlled Render ingress."""
RENDER_PROXY_OPTIONS = {
    "trusted_proxy": "*",
    "trusted_proxy_headers": {"x-forwarded-proto"},
    # Django's Render-specific rate limiter consumes the original client list.
    # Forwarded host is never enabled in Django.
    "clear_untrusted_proxy_headers": False,
}
