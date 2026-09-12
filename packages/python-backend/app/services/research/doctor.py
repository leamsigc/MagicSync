"""Doctor: per-channel health that never takes the whole report down."""

from app.services.research.channels import get_all_channels


def check_all(config: dict | None = None) -> dict[str, dict]:
    results: dict[str, dict] = {}
    for channel in get_all_channels():
        try:
            status, message = channel.check(config)
            active = channel.active_backend
        except Exception as exc:
            status, message, active = "error", f"check failed: {exc}", None
        results[channel.name] = {
            "status": status,
            "name": channel.description,
            "message": message,
            "tier": channel.tier,
            "backends": channel.backends,
            "active_backend": active,
        }
    return results


def format_report(results: dict[str, dict]) -> str:
    lines = ["Research channels:"]
    for key, result in results.items():
        lines.append(f"- {key}: {result['status']} ({result['message']})")
    return "\n".join(lines)
