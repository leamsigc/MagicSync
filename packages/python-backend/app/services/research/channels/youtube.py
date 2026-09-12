import shutil
import subprocess

from app.services.research.channels.base import Channel


class YouTubeChannel(Channel):
    name = "youtube"
    description = "YouTube subtitles and search"
    backends = ["yt-dlp"]
    tier = 0

    def can_handle(self, url: str) -> bool:
        return "youtube.com" in url or "youtu.be" in url

    def check(self, config: dict | None = None) -> tuple[str, str]:
        if not shutil.which("yt-dlp"):
            self.active_backend = None
            return "off", "yt-dlp not installed"
        try:
            completed = subprocess.run(
                ["yt-dlp", "--version"], capture_output=True, timeout=15
            )
            if completed.returncode == 0:
                self.active_backend = "yt-dlp"
                return "ok", "yt-dlp ready"
        except Exception as exc:
            self.active_backend = None
            return "error", f"yt-dlp probe failed: {exc}"
        self.active_backend = None
        return "warn", "yt-dlp installed but not runnable"
