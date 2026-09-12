"""HMAC machine authentication for Python-to-Nuxt callbacks (T100).

Service-to-service calls prove possession of the shared bridge secret with
a timestamped HMAC over the exact request bytes. Nuxt verifies in
``packages/db/server/utils/machine-auth.ts``. Replay window: ±300 seconds.
"""

import hashlib
import hmac
import time

SKEW_SECONDS = 300


def machine_headers(secret: str, body: bytes) -> dict:
    """Build X-Machine-* headers for a request body."""
    timestamp = str(int(time.time()))
    signature = hmac.new(
        secret.encode("utf-8"), timestamp.encode("utf-8") + b"." + body, hashlib.sha256
    ).hexdigest()
    return {"X-Machine-Timestamp": timestamp, "X-Machine-Signature": signature}
