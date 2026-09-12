"""Read-only chat analytics over social-post tables (Phase 4 backend).

The Nuxt app owns ``local.db`` (Turso sqlite) via drizzle; Python has no ORM
access to it, so this module mirrors the approach in ``app/core/db.py``
(plain ``sqlite3``) and opens the file read-only via URI ``mode=ro``.

Table shapes mirrored from ``packages/db``:

- ``posts(id, content, status, published_at, ...)``
- ``platform_posts(id, post_id, social_account_id, status, published_at, ...)``
- ``post_metrics(id, post_id, platform_post_id, social_account_id, platform,
  metrics JSON, status, collected_at, ...)`` where ``metrics`` follows
  ``NormalizedPostMetrics`` (``stats-normalizer.ts``): likes, comments,
  shares, views, reach, impressions, saves, quotes, bookmarks, retweets,
  reposts, total.

Join notes: ``post_metrics`` carries ``post_id`` and ``platform`` directly,
so aggregation joins ``posts -> post_metrics``. Joining ``platform_posts``
as well would fan out rows (one platform post x N metric snapshots) and
corrupt the sums, so it is bypassed deliberately; ``get_post_metrics``
still attempts a ``platform_posts`` join first to honour the interface
contract, with a direct-query fallback.

Formulas
--------
- ``engagement_rate``: ``(likes + comments + shares) / max(audience, 1) * 100``
  rounded to 2dp, where ``audience`` is views-or-reach.
- ``virality_score``: weighted blend clamped to 0-100::

      views_part = min(views / 10000, 1) * 50
      er_part    = min(engagement_rate / 10, 1) * 30
      buzz_part  = min((likes + 2 * comments + 3 * shares) / 1000, 1) * 20
      score      = views_part + er_part + buzz_part

  Tiers: ``breakout`` >= 75, ``viral`` >= 50, ``steady`` >= 25,
  else ``sleeper``.
"""

import json
import os
import sqlite3
import time
from pathlib import Path

METRIC_KEYS = ("likes", "comments", "shares", "views", "reach", "impressions")

_GET_METRICS_JOIN_SQL = (
    "SELECT pm.metrics FROM post_metrics pm "
    "LEFT JOIN platform_posts pp ON pm.platform_post_id = pp.id "
    "WHERE pm.post_id = ?"
)
_GET_METRICS_DIRECT_SQL = "SELECT metrics FROM post_metrics WHERE post_id = ?"

_BEST_POSTS_SQL = (
    "SELECT p.id, p.content, p.published_at, pm.platform, pm.metrics "
    "FROM posts p LEFT JOIN post_metrics pm ON pm.post_id = p.id "
    "WHERE p.status = 'published' AND p.published_at IS NOT NULL "
    "AND (p.published_at >= ? "
    "OR (p.published_at < 100000000000 AND p.published_at >= ?))"
)

_BLOCK_HINTS = {
    "hook": "open with a scroll-stopping line",
    "body": "develop one point",
    "cta": "invite one clear action",
    "closer": "land a memorable closing line",
}


def resolve_db_path() -> str:
    """Return the sqlite file holding the app tables.

    ``MAGICSYNC_DB_PATH`` wins (tests use this). Otherwise the repo-root
    ``local.db``: ``parents[5]`` of this file (analytics -> services ->
    app -> python-backend -> packages -> repo root), with ``parents[4]``
    as fallback.
    """
    env_path = os.getenv("MAGICSYNC_DB_PATH")
    if env_path:
        return env_path
    parents = Path(__file__).resolve().parents
    repo_root = parents[5] if len(parents) > 5 else parents[0]
    candidate = repo_root / "local.db"
    if candidate.exists():
        return str(candidate)
    return str(parents[4] / "local.db")


def open_ro_db(path: str | None = None) -> sqlite3.Connection:
    """Open a read-only sqlite connection (URI ``mode=ro``)."""
    db_path = path if path is not None else resolve_db_path()
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def zero_metrics() -> dict:
    """Return a zeroed canonical metrics dict."""
    return {key: 0 for key in METRIC_KEYS}


def _num(value: object) -> float:
    """Coerce a metric value to float; non-numeric becomes 0.0."""
    return float(value) if isinstance(value, (int, float)) else 0.0


def _parse_metrics_json(raw: object) -> dict:
    """Parse a ``post_metrics.metrics`` JSON blob into a dict."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (ValueError, TypeError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _sum_metric_blobs(blobs: list) -> dict:
    """Sum canonical metrics over raw JSON blobs (alias-aware)."""
    totals = zero_metrics()
    for blob in blobs:
        metrics = _parse_metrics_json(blob)
        totals["likes"] += _num(metrics.get("likes"))
        totals["comments"] += _num(metrics.get("comments"))
        totals["shares"] += _num(metrics.get("shares"))
        totals["shares"] += _num(metrics.get("retweets"))
        totals["shares"] += _num(metrics.get("reposts"))
        totals["shares"] += _num(metrics.get("quotes"))
        totals["views"] += _num(metrics.get("views"))
        totals["reach"] += _num(metrics.get("reach"))
        totals["impressions"] += _num(metrics.get("impressions"))
    return totals


def get_post_metrics(db: sqlite3.Connection, post_id: str) -> dict:
    """Sum metrics across ``post_metrics`` rows for one post.

    Tries the ``platform_posts`` join first, then a direct query. Returns
    zeros on missing tables/rows/ids; never raises.
    """
    try:
        rows = db.execute(_GET_METRICS_JOIN_SQL, (post_id,)).fetchall()
    except Exception:
        try:
            rows = db.execute(_GET_METRICS_DIRECT_SQL, (post_id,)).fetchall()
        except Exception:
            return zero_metrics()
    return _sum_metric_blobs([row[0] for row in rows])


def engagement_rate(
    likes: float, comments: float, shares: float, views_or_reach: float
) -> float:
    """Return ``(likes+comments+shares)/max(audience,1)*100`` rounded to 2dp."""
    denom = max(_num(views_or_reach), 1.0)
    total = _num(likes) + _num(comments) + _num(shares)
    return round((total / denom) * 100, 2)


def virality_score(metrics: dict) -> dict:
    """Score ``metrics`` 0-100 with a tier label.

    Formula (documented in the module docstring): 50% views reach
    (``min(views/10000, 1)``), 30% engagement rate (``min(er/10, 1)``),
    20% weighted buzz (``min((likes + 2*comments + 3*shares)/1000, 1)``).
    Uses ``metrics["engagement_rate"]`` when present, else derives it.
    Tiers: breakout >= 75, viral >= 50, steady >= 25, else sleeper.
    """
    data = metrics if isinstance(metrics, dict) else {}
    views = _num(data.get("views"))
    likes = _num(data.get("likes"))
    comments = _num(data.get("comments"))
    shares = _num(data.get("shares"))
    raw_er = data.get("engagement_rate")
    er = (
        raw_er
        if isinstance(raw_er, (int, float))
        else engagement_rate(likes, comments, shares, views)
    )
    views_part = min(views / 10000.0, 1.0) * 50.0
    er_part = min(er / 10.0, 1.0) * 30.0
    buzz = likes + (comments * 2.0) + (shares * 3.0)
    buzz_part = min(buzz / 1000.0, 1.0) * 20.0
    score = round(views_part + er_part + buzz_part, 2)
    tier = "sleeper"
    if score >= 75.0:
        tier = "breakout"
    elif score >= 50.0:
        tier = "viral"
    elif score >= 25.0:
        tier = "steady"
    return {
        "score": score,
        "tier": tier,
        "engagement_rate": round(er, 2),
        "breakdown": {
            "views_part": round(views_part, 2),
            "engagement_part": round(er_part, 2),
            "buzz_part": round(buzz_part, 2),
        },
    }


def _group_post_rows(rows: list) -> dict:
    """Group joined post/metric rows by post id."""
    grouped: dict[str, dict] = {}
    for row in rows:
        post_id = str(row[0])
        entry = grouped.get(post_id)
        if entry is None:
            content = row[1] if row[1] is not None else ""
            grouped[post_id] = {
                "id": post_id,
                "content": content,
                "published_at": row[2],
                "platforms": [],
                "metric_blobs": [],
            }
            entry = grouped[post_id]
        entry["platforms"].append(row[3])
        entry["metric_blobs"].append(row[4])
    return grouped


def _first_platform(platforms: list) -> str:
    """Return the first non-empty platform name, else ``unknown``."""
    for name in platforms:
        if name:
            return str(name)
    return "unknown"


def best_posts(
    db: sqlite3.Connection,
    days: int = 7,
    platform: str | None = None,
    limit: int = 5,
) -> list:
    """Return top published posts in the window ranked by engagement rate.

    Audience base is ``max(views, reach, impressions)`` so posts tracked
    with any single audience metric rank comparably. Returns ``[]`` when
    the store is unavailable; never raises.
    """
    try:
        days_int = max(int(days), 1)
        limit_int = max(int(limit), 1)
        cutoff_ms = int(time.time() * 1000) - (days_int * 86400000)
        cutoff_s = cutoff_ms // 1000
        sql = _BEST_POSTS_SQL
        params: list = [cutoff_ms, cutoff_s]
        if platform:
            sql += " AND pm.platform = ?"
            params.append(platform)
        rows = db.execute(sql, tuple(params)).fetchall()
    except Exception:
        return []
    grouped = _group_post_rows(rows)
    scored: list[dict] = []
    for entry in grouped.values():
        totals = _sum_metric_blobs(entry["metric_blobs"])
        audience = max(totals["views"], totals["reach"], totals["impressions"])
        rate = engagement_rate(
            totals["likes"], totals["comments"], totals["shares"], audience
        )
        scored.append(
            {
                "id": entry["id"],
                "content": entry["content"],
                "platform": _first_platform(entry["platforms"]),
                "published_at": entry["published_at"],
                "metrics": totals,
                "engagement_rate": rate,
            }
        )
    scored.sort(key=lambda item: item["engagement_rate"], reverse=True)
    return scored[:limit_int]


def _has_emoji(text: str) -> bool:
    """Heuristic emoji check: any char above the box-drawing block."""
    for char in text:
        if ord(char) > 0x2500:
            return True
    return False


def _hook_style(first_line: str) -> str:
    """Classify the opening line of a post."""
    if "?" in first_line:
        return "question_hook"
    if _has_emoji(first_line):
        return "emoji_hook"
    return "statement_hook"


def _cta_style(last_line: str) -> str:
    """Classify the closing line of a post."""
    lowered = last_line.lower()
    if "http" in lowered or "link in bio" in lowered:
        return "link_cta"
    if "?" in last_line:
        return "question_cta"
    if _has_emoji(last_line):
        return "emoji_cta"
    return "soft_close"


def _split_lines(content: object) -> list:
    """Split content into non-empty stripped lines."""
    lines = []
    for raw in str(content).splitlines():
        stripped = raw.strip()
        if stripped:
            lines.append(stripped)
    return lines


def extract_template(content: str, platform: str = "unknown") -> dict:
    """Derive a reusable template from post text (pure, no DB).

    Heuristics: first non-empty line is the hook, middle lines are body,
    the last line is a CTA when it carries a link/question/emoji,
    otherwise a closer.
    """
    lines = _split_lines(content)
    hook = lines[0] if lines else ""
    last = lines[len(lines) - 1] if len(lines) > 1 else ""
    hook_style = _hook_style(hook)
    cta_style = _cta_style(last)
    closer = "cta" if cta_style != "soft_close" else "closer"
    structure = ["hook"] + (["body"] * max(len(lines) - 2, 0)) + [closer]
    text = str(content)
    tone_notes = (
        f"{len(lines)} blocks, {len(text)} chars, "
        f"{text.count('#')} hashtags, hook {hook_style}, close {cta_style}"
    )
    return {
        "hook_style": hook_style,
        "structure": structure,
        "cta_style": cta_style,
        "tone_notes": tone_notes,
        "platform": platform,
    }


def _post_platform(db: sqlite3.Connection, post_id: str) -> str:
    """Return the first tracked platform for a post, else ``unknown``."""
    try:
        row = db.execute(
            "SELECT platform FROM post_metrics WHERE post_id = ? LIMIT 1",
            (post_id,),
        ).fetchone()
    except Exception:
        return "unknown"
    if row is None or not row[0]:
        return "unknown"
    return str(row[0])


def destructure_post(db: sqlite3.Connection, post_id: str) -> dict:
    """Break a stored post into a reusable template dict.

    Returns ``{"error": ...}`` for unknown ids or an unavailable store;
    never raises.
    """
    try:
        row = db.execute(
            "SELECT content FROM posts WHERE id = ?", (post_id,)
        ).fetchone()
    except Exception:
        return {"error": "analytics store unavailable"}
    if row is None:
        return {"error": f"post not found: {post_id}"}
    raw = row[0]
    content = raw if isinstance(raw, str) else ""
    template = extract_template(content, _post_platform(db, post_id))
    template["post_id"] = post_id
    return template


def apply_template(
    template: dict, theme: str, business_context: str = ""
) -> dict:
    """Reuse a template's structure for a new theme (LLM-free assembly).

    Returns ``{"outline", "caption_draft_notes", "theme", "structure"}``;
    the writer agent fleshes the outline into a full caption.
    """
    data = template if isinstance(template, dict) else {}
    structure = data.get("structure", [])
    blocks = (
        list(structure)
        if isinstance(structure, list) and len(structure) > 0
        else ["hook", "body", "cta"]
    )
    hook_style = data.get("hook_style", "statement_hook")
    cta_style = data.get("cta_style", "soft_close")
    outline = []
    for block in blocks:
        hint = _BLOCK_HINTS.get(str(block), "continue the post")
        outline.append(f"{block}: {hint} — angle: {theme}")
    notes = (
        f"Theme: {theme}. Keep hook style '{hook_style}' "
        f"and close with '{cta_style}'."
    )
    if business_context:
        notes = f"{notes} Business context: {business_context}."
    return {
        "outline": outline,
        "caption_draft_notes": notes,
        "theme": theme,
        "structure": blocks,
    }
