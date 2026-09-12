"""Truthful in-process harness run status (T110).

Records lifecycle transitions written by the execution paths. Unknown run
IDs return None (the API layer maps that to 404) — statuses are never
fabricated.
"""

import time

_runs: dict = {}


def record_run(run_id: str, status: str, detail: dict | None = None) -> dict:
    """Record a run lifecycle transition. Returns the stored record."""
    entry = _runs.get(run_id, {"run_id": run_id})
    entry.update({"status": status, "updated_at": time.time()})
    if detail:
        entry.update(detail)
    _runs[run_id] = entry
    return entry


def get_run(run_id: str) -> dict | None:
    """Return the stored record, or None for unknown runs."""
    return _runs.get(run_id)


def clear_runs() -> None:
    """Test helper: reset the registry."""
    _runs.clear()
