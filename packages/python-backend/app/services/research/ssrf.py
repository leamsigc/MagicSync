"""SSRF protection for outbound research fetches (T50, PRD §6).

Every outbound request must pass through :func:`validate_url` before
connecting, and every redirect through :func:`validate_redirect`. DNS is
resolved and every address classified; private, loopback, link-local,
multicast, reserved, and unspecified ranges are rejected for both IPv4 and
IPv6, as are non-HTTP schemes, userinfo, and unusual ports.
"""

import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = frozenset({"http", "https"})
DEFAULT_PORTS = {"http": 80, "https": 443}
MAX_REDIRECTS = 5
MAX_URL_LENGTH = 2048

# Cloud metadata endpoints that must never be reachable, even via DNS tricks.
METADATA_HOSTS = frozenset(
    {
        "metadata.google.internal",
        "metadata.google.com",
        "instance-data",
        "instance-data-compute",
    }
)


class SSRFError(ValueError):
    """Outbound request blocked by SSRF policy."""


def _classify_ip(raw: str) -> str | None:
    """Return a block reason for non-public IPs, else None."""
    try:
        ip = ipaddress.ip_address(raw)
    except ValueError:
        return f"unresolvable address: {raw!r}"
    if ip.is_loopback:
        return "loopback address"
    if ip.is_private:
        return "private address"
    if ip.is_link_local:
        return "link-local address"
    if ip.is_multicast:
        return "multicast address"
    if ip.is_reserved:
        return "reserved address"
    if ip.is_unspecified:
        return "unspecified address"
    return None


def resolve_and_classify(host: str) -> list:
    """Resolve a host and return (ip, block_reason) pairs for every address."""
    try:
        infos = socket.getaddrinfo(host, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return [(host, f"DNS resolution failed for {host!r}")]
    seen: dict = {}
    for info in infos:
        ip = info[4][0]
        seen.setdefault(ip, _classify_ip(ip))
    return list(seen.items())


def validate_url(url: str, *, allowed_ports: set | None = None) -> str:
    """Validate an outbound URL. Returns the normalized URL or raises SSRFError."""
    if not url or len(url) > MAX_URL_LENGTH:
        raise SSRFError("URL is empty or too long")
    try:
        parsed = urlparse(url.strip())
    except Exception as exc:
        raise SSRFError(f"URL parse failed: {exc}") from exc
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise SSRFError(f"URL scheme not allowed: {parsed.scheme!r}")
    if parsed.username or parsed.password:
        raise SSRFError("URL userinfo is not allowed")
    host = (parsed.hostname or "").lower().rstrip(".")
    if not host:
        raise SSRFError("URL has no host")
    if host in METADATA_HOSTS:
        raise SSRFError(f"Metadata endpoint blocked: {host!r}")
    port = parsed.port or DEFAULT_PORTS[parsed.scheme]
    allowed = allowed_ports if allowed_ports is not None else set(DEFAULT_PORTS.values())
    if port not in allowed:
        raise SSRFError(f"URL port not allowed: {port}")
    for ip, reason in resolve_and_classify(host):
        if reason:
            raise SSRFError(f"URL host {host!r} resolves to blocked {ip}: {reason}")
    return parsed.geturl()


def validate_redirect(location: str, *, allowed_ports: set | None = None) -> str:
    """Revalidate a redirect target (DNS rebinding defense)."""
    return validate_url(location, allowed_ports=allowed_ports)


def check_redirect_chain(chain: list) -> None:
    """Reject over-long redirect chains."""
    if len(chain) > MAX_REDIRECTS:
        raise SSRFError(f"Too many redirects ({len(chain)})")
