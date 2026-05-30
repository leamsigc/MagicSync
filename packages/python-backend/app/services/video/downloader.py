import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import yt_dlp

logger = logging.getLogger(__name__)


class VideoDownloadError(Exception):
    pass


class VideoDownloadResult:
    def __init__(
        self,
        filepath: str,
        filename: str,
        title: str,
        duration: int | None,
        ext: str,
        width: int | None,
        height: int | None,
        webpage_url: str,
        thumbnail: str | None,
    ):
        self.filepath = filepath
        self.filename = filename
        self.title = title
        self.duration = duration
        self.ext = ext
        self.width = width
        self.height = height
        self.webpage_url = webpage_url
        self.thumbnail = thumbnail

    def to_dict(self) -> dict[str, Any]:
        return {
            "filepath": self.filepath,
            "filename": self.filename,
            "title": self.title,
            "duration": self.duration,
            "ext": self.ext,
            "width": self.width,
            "height": self.height,
            "webpage_url": self.webpage_url,
            "thumbnail": self.thumbnail,
        }


class VideoDownloaderService:
    DOWNLOAD_DIR: str | None = None

    def _get_download_dir(self) -> str:
        if self.DOWNLOAD_DIR:
            os.makedirs(self.DOWNLOAD_DIR, exist_ok=True)
            return self.DOWNLOAD_DIR
        return tempfile.mkdtemp(prefix="magicsync_video_")

    async def download(self, url: str) -> VideoDownloadResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._download_sync, url)

    def _download_sync(self, url: str) -> VideoDownloadResult:
        download_dir = self._get_download_dir()
        outtmpl = os.path.join(download_dir, "%(id)s.%(ext)s")

        ydl_opts: dict[str, Any] = {
            "format": "best[ext=mp4]/best",
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

                if not info:
                    raise VideoDownloadError("Failed to extract video info")

                video_id = info.get("id", "unknown")
                ext = info.get("ext", "mp4")
                filepath = os.path.join(download_dir, f"{video_id}.{ext}")

                if not os.path.exists(filepath):
                    possible = Path(download_dir)
                    files = list(possible.glob(f"{video_id}.*"))
                    if files:
                        filepath = str(files[0])
                    else:
                        raise VideoDownloadError("Downloaded file not found on disk")

                title = info.get("title", "Untitled")
                duration = info.get("duration")
                width = info.get("width")
                height = info.get("height")
                webpage_url = info.get("webpage_url", url)
                thumbnail = info.get("thumbnail")

                return VideoDownloadResult(
                    filepath=filepath,
                    filename=os.path.basename(filepath),
                    title=title,
                    duration=duration,
                    ext=ext,
                    width=width,
                    height=height,
                    webpage_url=webpage_url,
                    thumbnail=thumbnail,
                )

        except yt_dlp.utils.DownloadError as e:
            raise VideoDownloadError(f"yt-dlp download failed: {e}") from e
        except Exception as e:
            raise VideoDownloadError(f"Unexpected error during download: {e}") from e