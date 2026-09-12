"""Channel base class — one file per platform.

Backend routing: `backends` is an ORDERED candidate list, backends[0] is
preferred. Switching backends = reordering, not rewriting. check() must set
active_backend to the backend actually serving now (None = unavailable).
"""

from abc import ABC, abstractmethod


class Channel(ABC):
    name: str = ""
    description: str = ""
    backends: list[str] = []
    tier: int = 0  # 0=zero-config, 1=needs key/login, 2=complex setup

    active_backend: str | None = None

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        ...

    def check(self, config: dict | None = None) -> tuple[str, str]:
        self.active_backend = self.backends[0] if self.backends else "builtin"
        return "ok", ", ".join(self.backends) if self.backends else "builtin"

    def ordered_backends(self, config: dict | None = None) -> list[str]:
        candidates = list(self.backends)
        override = (config or {}).get(f"{self.name}_backend")
        if override:
            for i, backend in enumerate(candidates):
                if backend == override or backend.startswith(override):
                    candidates.insert(0, candidates.pop(i))
                    break
        return candidates
