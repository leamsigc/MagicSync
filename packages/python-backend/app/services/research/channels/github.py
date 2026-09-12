import shutil
import subprocess

from app.services.research.channels.base import Channel


class GitHubChannel(Channel):
    name = "github"
    description = "Public repos, search, issues"
    backends = ["gh-cli"]
    tier = 1

    def can_handle(self, url: str) -> bool:
        return "github.com" in url

    def check(self, config: dict | None = None) -> tuple[str, str]:
        if not shutil.which("gh"):
            self.active_backend = None
            return "off", "gh CLI not installed (public read still possible via web channel)"
        try:
            completed = subprocess.run(
                ["gh", "auth", "status"], capture_output=True, timeout=15
            )
            if completed.returncode == 0:
                self.active_backend = "gh-cli"
                return "ok", "gh CLI authenticated"
        except Exception as exc:
            self.active_backend = None
            return "error", f"gh probe failed: {exc}"
        self.active_backend = "gh-cli"
        return "warn", "gh CLI installed but not authenticated"
