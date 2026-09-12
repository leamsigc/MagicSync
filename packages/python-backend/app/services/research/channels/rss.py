import xml.etree.ElementTree as ET

import httpx

from app.services.research.channels.base import Channel


class RssChannel(Channel):
    name = "rss"
    description = "Read any RSS/Atom feed"
    backends = ["builtin"]
    tier = 0

    def can_handle(self, url: str) -> bool:
        lowered = url.lower()
        return lowered.endswith(".xml") or "rss" in lowered or "atom" in lowered

    async def read(self, url: str) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url)
            response.raise_for_status()
        root = ET.fromstring(response.text)
        return parse_feed_items(root)

    def check(self, config: dict | None = None) -> tuple[str, str]:
        self.active_backend = "builtin"
        return "ok", "builtin xml parser ready"


def parse_feed_items(root: ET.Element) -> list[dict]:
    items: list[dict] = []
    for item in root.iter("item"):
        items.append(
            {
                "title": find_text(item, "title"),
                "link": find_text(item, "link"),
                "published": find_text(item, "pubDate"),
            }
        )
    for entry in root.iter("{http://www.w3.org/2005/Atom}entry"):
        items.append(
            {
                "title": find_text(entry, "{http://www.w3.org/2005/Atom}title"),
                "link": find_link(entry),
                "published": find_text(entry, "{http://www.w3.org/2005/Atom}updated"),
            }
        )
    return items


def find_text(parent: ET.Element, tag: str) -> str:
    child = parent.find(tag)
    return child.text.strip() if child is not None and child.text else ""


def find_link(entry: ET.Element) -> str:
    link = entry.find("{http://www.w3.org/2005/Atom}link")
    return link.get("href", "") if link is not None else ""
