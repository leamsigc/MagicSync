"""T50 — SSRF policy unit tests (PRD §6)."""

import pytest

from app.services.research.ssrf import (
    SSRFError,
    check_redirect_chain,
    resolve_and_classify,
    validate_redirect,
    validate_url,
)


class TestValidateUrl:
    def test_public_url_passes(self):
        assert validate_url("https://example.com/article").startswith("https://")

    @pytest.mark.parametrize("url", [
        "ftp://example.com/file",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "gopher://example.com/",
        "http://user:pass@example.com/",
    ])
    def test_schemes_and_userinfo_rejected(self, url):
        with pytest.raises(SSRFError):
            validate_url(url)

    @pytest.mark.parametrize("url", [
        "http://localhost/admin",
        "http://127.0.0.1/",
        "http://[::1]/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.4.2/",
        "http://169.254.169.254/latest/meta-data/",
        "http://[fd00::1]/",
        "http://[fe80::1]/",
        "http://0.0.0.0/",
    ])
    def test_non_public_hosts_rejected(self, url):
        with pytest.raises(SSRFError):
            validate_url(url)

    def test_metadata_hostnames_rejected(self):
        with pytest.raises(SSRFError):
            validate_url("http://metadata.google.internal/")

    def test_unusual_port_rejected(self):
        with pytest.raises(SSRFError):
            validate_url("https://example.com:8443/x")

    def test_empty_and_oversize_rejected(self):
        with pytest.raises(SSRFError):
            validate_url("")
        with pytest.raises(SSRFError):
            validate_url("https://example.com/" + "a" * 2048)


class TestRedirects:
    def test_redirect_chain_limit(self):
        with pytest.raises(SSRFError):
            check_redirect_chain([f"https://example.com/{i}" for i in range(6)])
        check_redirect_chain(["https://example.com/1"])

    def test_redirect_target_revalidated(self):
        with pytest.raises(SSRFError):
            validate_redirect("http://127.0.0.1/evil")


class TestDnsClassification:
    def test_loopback_classified(self):
        pairs = dict(resolve_and_classify("localhost"))
        assert any("loopback" in reason or "private" in reason or "resolution" in reason for reason in pairs.values())
