"""T30.2 — scoped capability tokens for DSH tool execution."""

import time

import pytest

from app.services.dsh.capability import (
    CapabilityError,
    clear_nonce_cache,
    issue_capability,
    verify_capability,
)

SECRET = "test-capability-secret"


@pytest.fixture(autouse=True)
def _clean_nonces():
    clear_nonce_cache()
    yield
    clear_nonce_cache()


def _token(**overrides):
    params = {
        "secret": SECRET,
        "user_id": "user-1",
        "business_id": "biz-1",
        "workflow_id": "wf-1",
        "run_id": "run-1",
        "allowed_tools": ["web_search", "retrieve"],
        "allowed_skills": ["social-research"],
    }
    params.update(overrides)
    return issue_capability(**params)


class TestCapability:
    def test_round_trip(self):
        claims = verify_capability(
            _token(), secret=SECRET, business_id="biz-1", run_id="run-1", tool="web_search"
        )
        assert claims["sub"] == "user-1"
        assert claims["aud"] == "magicsync-dsh"

    def test_missing_secret_fails_closed(self):
        with pytest.raises(CapabilityError) as exc:
            issue_capability(
                secret="", user_id="u", business_id="b", workflow_id="w",
                run_id="r", allowed_tools=[],
            )
        assert exc.value.code == "misconfigured"
        with pytest.raises(CapabilityError) as exc2:
            verify_capability(_token(), secret="", business_id="biz-1", run_id="run-1")
        assert exc2.value.code == "misconfigured"

    def test_forged_token_rejected(self):
        with pytest.raises(CapabilityError) as exc:
            verify_capability(_token(secret="other-secret"), secret=SECRET, business_id="biz-1", run_id="run-1")
        assert exc.value.code == "invalid"

    def test_expired_token_rejected(self):
        token = _token(ttl_seconds=1)
        time.sleep(1.1)
        with pytest.raises(CapabilityError) as exc:
            verify_capability(token, secret=SECRET, business_id="biz-1", run_id="run-1")
        assert exc.value.code == "expired"

    def test_replay_rejected(self):
        token = _token()
        verify_capability(token, secret=SECRET, business_id="biz-1", run_id="run-1")
        with pytest.raises(CapabilityError) as exc:
            verify_capability(token, secret=SECRET, business_id="biz-1", run_id="run-1")
        assert exc.value.code == "replayed"

    def test_wrong_business_rejected(self):
        with pytest.raises(CapabilityError) as exc:
            verify_capability(_token(), secret=SECRET, business_id="biz-2", run_id="run-1")
        assert exc.value.code == "wrong_business"

    def test_wrong_run_rejected(self):
        with pytest.raises(CapabilityError) as exc:
            verify_capability(_token(), secret=SECRET, business_id="biz-1", run_id="run-2")
        assert exc.value.code == "wrong_run"

    def test_unauthorized_tool_rejected(self):
        with pytest.raises(CapabilityError) as exc:
            verify_capability(_token(), secret=SECRET, business_id="biz-1", run_id="run-1", tool="execute_code")
        assert exc.value.code == "tool_denied"

    def test_ttl_bounds(self):
        with pytest.raises(CapabilityError):
            _token(ttl_seconds=0)
        with pytest.raises(CapabilityError):
            _token(ttl_seconds=99999)
