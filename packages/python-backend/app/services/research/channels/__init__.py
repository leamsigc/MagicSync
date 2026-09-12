from app.services.research.channels.base import Channel
from app.services.research.channels.web import WebChannel
from app.services.research.channels.youtube import YouTubeChannel
from app.services.research.channels.github import GitHubChannel
from app.services.research.channels.rss import RssChannel
from app.services.research.channels.scrapegraph import ScrapeGraphChannel

_CHANNELS: list[Channel] = [
    WebChannel(),
    YouTubeChannel(),
    GitHubChannel(),
    RssChannel(),
    ScrapeGraphChannel(),
]


def get_all_channels() -> list[Channel]:
    return list(_CHANNELS)


def get_channel(name: str) -> Channel | None:
    return next((c for c in _CHANNELS if c.name == name), None)
