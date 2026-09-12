"""Credential-envelope guarantees for the LLM JWT bridge (T00.2).

The Nuxt side transports BYOK keys as AES-256-GCM `enc:v1:` envelopes
(publish-crypto). The Python side must decrypt those envelopes, and must
never accept legacy plaintext or base64 values as credentials.
"""

import base64
import hashlib
import os

import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core import security
from app.core.config import settings


def _b64url(part: bytes) -> str:
    return base64.urlsafe_b64encode(part).decode("ascii").rstrip("=")


def encrypt_like_nuxt(plaintext: str, secret: str | None = None) -> str:
    """Mirror Node publish-crypto encryptSecret (AES-256-GCM + scrypt key)."""
    key_secret = secret or (settings.nuxt_publish_secret or settings.llm_jwt_secret)
    key = hashlib.scrypt(key_secret.encode("utf-8"), salt=b"magicsync-publish", n=16384, r=8, p=1, dklen=32)
    nonce = os.urandom(12)
    ct_and_tag = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return f"enc:v1:{_b64url(nonce)}.{_b64url(ct_and_tag[-16:])}.{_b64url(ct_and_tag[:-16])}"


def _jwt_with_key(enc_value: str | None) -> str:
    payload = {
        "userId": "test-user",
        "email": "test@example.com",
        "provider": "openai",
        "model": "gpt-4o-mini",
        "apiKeyEncrypted": enc_value,
        "apiBaseUrl": None,
        "temperature": 0.7,
        "maxTokens": 2048,
        "iss": "magicsync-nuxt",
        "aud": "magicsync-python",
    }
    return jwt.encode(payload, settings.llm_jwt_secret, algorithm="HS256")


class TestDecryptSecret:
    def test_encrypted_round_trip(self):
        assert security.decrypt_secret(encrypt_like_nuxt("sk-live-key")) == "sk-live-key"

    def test_legacy_base64_rejected(self):
        legacy = base64.b64encode(b"sk-live-key").decode("ascii")
        assert security.decrypt_secret(legacy) is None

    def test_plaintext_rejected(self):
        assert security.decrypt_secret("sk-live-key") is None

    def test_tampered_ciphertext_rejected(self):
        envelope = encrypt_like_nuxt("sk-live-key")
        head, _dot, tail = envelope.rpartition(".")
        tampered = f"{head}.{'A' * len(tail)}"
        assert security.decrypt_secret(tampered) is None

    def test_none_and_empty_rejected(self):
        assert security.decrypt_secret(None) is None
        assert security.decrypt_secret("") is None

    def test_wrong_secret_rejected(self):
        envelope = encrypt_like_nuxt("sk-live-key", secret="some-other-secret")
        assert security.decrypt_secret(envelope) is None


class TestDecodeLlmJwt:
    def test_encrypted_key_decoded(self):
        ctx = security.decode_llm_jwt(_jwt_with_key(encrypt_like_nuxt("sk-live-key")))
        assert ctx is not None
        assert ctx.llm_config.api_key == "sk-live-key"

    def test_base64_key_yields_none(self):
        legacy = base64.b64encode(b"sk-live-key").decode("ascii")
        ctx = security.decode_llm_jwt(_jwt_with_key(legacy))
        assert ctx is not None
        assert ctx.llm_config.api_key is None

    def test_missing_key_yields_none(self):
        ctx = security.decode_llm_jwt(_jwt_with_key(None))
        assert ctx is not None
        assert ctx.llm_config.api_key is None
