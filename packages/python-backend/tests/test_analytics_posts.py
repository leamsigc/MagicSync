"""Tests for Phase 4 chat analytics (app/services/analytics/posts.py)."""

import json
import sqlite3
import time

import pytest

from app.services.analytics.posts import (
    apply_template,
    best_posts,
    destructure_post,
    engagement_rate,
    extract_template,
    get_post_metrics,
    resolve_db_path,
    virality_score,
)
from app.services.tools.manager import ToolManager

MS_PER_DAY = 86400000


def _metrics_blob(**kwargs) -> str:
    base = {"likes": 0, "comments": 0, "shares": 0, "views": 0, "total": 0}
    base.update(kwargs)
    return json.dumps(base)


@pytest.fixture
def analytics_db(tmp_path):
    """Build a minimal posts/platform_posts/post_metrics sqlite DB."""
    db_path = tmp_path / "analytics.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE posts (id TEXT PRIMARY KEY, content TEXT NOT NULL, "
        "status TEXT NOT NULL DEFAULT 'pending', published_at INTEGER, "
        "target_platforms TEXT NOT NULL DEFAULT '[]')"
    )
    conn.execute(
        "CREATE TABLE platform_posts (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, "
        "social_account_id TEXT NOT NULL, "
        "status TEXT NOT NULL DEFAULT 'pending', published_at INTEGER)"
    )
    conn.execute(
        "CREATE TABLE post_metrics (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, "
        "platform_post_id TEXT, social_account_id TEXT NOT NULL, "
        "platform TEXT NOT NULL, metrics TEXT NOT NULL, "
        "status TEXT NOT NULL DEFAULT 'success', collected_at INTEGER NOT NULL)"
    )
    now_ms = int(time.time() * 1000)
    day_ago = now_ms - MS_PER_DAY
    two_days_ago = now_ms - (2 * MS_PER_DAY)
    old = now_ms - (30 * MS_PER_DAY)

    posts = [
        ("p1", "Viral twitter post", "published", day_ago, '["twitter"]'),
        ("p2", "Steady linkedin post", "published", two_days_ago, '["linkedin"]'),
        ("p3", "Small twitter post", "published", day_ago, '["twitter"]'),
        ("p_old", "Ancient huge post", "published", old, '["twitter"]'),
        ("p_pending", "Pending huge post", "pending", day_ago, '["twitter"]'),
        (
            "p_template",
            "Want more signups?\n\nHere is the exact playbook we used.\n"
            "It takes 10 minutes a day.\n\n"
            "Get the full guide: https://example.com/guide #growth",
            "published",
            day_ago,
            '["twitter"]',
        ),
    ]
    conn.executemany(
        "INSERT INTO posts (id, content, status, published_at, target_platforms)"
        " VALUES (?, ?, ?, ?, ?)",
        posts,
    )
    platform_posts = [
        ("pp1", "p1", "acc1", "published", day_ago),
        ("pp2", "p2", "acc2", "published", two_days_ago),
        ("pp3", "p3", "acc1", "published", day_ago),
        ("pp_old", "p_old", "acc1", "published", old),
        ("pp_pending", "p_pending", "acc1", "pending", day_ago),
        ("pp_template", "p_template", "acc1", "published", day_ago),
    ]
    conn.executemany(
        "INSERT INTO platform_posts (id, post_id, social_account_id, status,"
        " published_at) VALUES (?, ?, ?, ?, ?)",
        platform_posts,
    )
    metrics = [
        # p1 split over two snapshots to exercise summing.
        ("m1a", "p1", "pp1", "acc1", "twitter",
         _metrics_blob(likes=1200, comments=200, shares=120, views=30000),
         "success", now_ms),
        ("m1b", "p1", "pp1", "acc1", "twitter",
         _metrics_blob(likes=800, comments=100, shares=80, views=20000),
         "success", now_ms),
        ("m2", "p2", "pp2", "acc2", "linkedin",
         _metrics_blob(likes=100, comments=10, shares=5, views=3000),
         "success", now_ms),
        # NULL platform_post_id row exercises the LEFT JOIN path.
        ("m3", "p3", None, "acc1", "twitter",
         _metrics_blob(likes=10, comments=2, shares=1, views=500),
         "success", now_ms),
        ("m_old", "p_old", "pp_old", "acc1", "twitter",
         _metrics_blob(likes=99999, comments=9999, shares=9999, views=9999999),
         "success", now_ms),
        ("m_pending", "p_pending", "pp_pending", "acc1", "twitter",
         _metrics_blob(likes=88888, comments=8888, shares=8888, views=8888888),
         "success", now_ms),
        ("m_template", "p_template", "pp_template", "acc1", "twitter",
         _metrics_blob(likes=50, comments=5, shares=2, views=10000),
         "success", now_ms),
    ]
    conn.executemany(
        "INSERT INTO post_metrics (id, post_id, platform_post_id,"
        " social_account_id, platform, metrics, status, collected_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        metrics,
    )
    conn.commit()
    yield conn
    conn.close()


class TestEngagementRate:
    def test_basic_formula(self):
        assert engagement_rate(100, 20, 30, 10000) == 1.5

    def test_zero_audience_guards_divide_by_zero(self):
        assert engagement_rate(10, 5, 0, 0) == 1500.0

    def test_none_audience_guards_divide_by_zero(self):
        assert engagement_rate(1, 1, 1, None) == 300.0


class TestViralityScore:
    def test_sleeper_tier_for_zeros(self):
        result = virality_score({})
        assert result["tier"] == "sleeper"
        assert result["score"] == 0

    def test_steady_tier(self):
        result = virality_score(
            {
                "views": 3000,
                "likes": 100,
                "comments": 10,
                "shares": 5,
                "engagement_rate": 3.0,
            }
        )
        assert result["tier"] == "steady"

    def test_viral_tier(self):
        result = virality_score(
            {
                "views": 8000,
                "likes": 400,
                "comments": 50,
                "shares": 30,
                "engagement_rate": 6.0,
            }
        )
        assert result["tier"] == "viral"

    def test_breakout_tier(self):
        result = virality_score(
            {
                "views": 50000,
                "likes": 2000,
                "comments": 300,
                "shares": 200,
                "engagement_rate": 12.0,
            }
        )
        assert result["tier"] == "breakout"
        assert result["score"] == 100.0

    def test_derives_engagement_rate_when_missing(self):
        result = virality_score(
            {"views": 10000, "likes": 500, "comments": 50, "shares": 50}
        )
        assert result["engagement_rate"] == 6.0
        assert result["tier"] == "breakout"


class TestExtractTemplate:
    def test_question_hook_body_link_cta(self):
        content = (
            "Want more signups?\n\n"
            "Here is the exact playbook we used.\n"
            "It takes 10 minutes a day.\n\n"
            "Read the full guide: https://example.com/guide"
        )
        template = extract_template(content, "twitter")
        assert template["hook_style"] == "question_hook"
        assert template["structure"] == ["hook", "body", "body", "cta"]
        assert template["cta_style"] == "link_cta"
        assert template["platform"] == "twitter"
        assert "hook question_hook" in template["tone_notes"]

    def test_statement_hook_soft_close(self):
        template = extract_template("Launch day.\n\nWe shipped v2 today.")
        assert template["hook_style"] == "statement_hook"
        assert template["cta_style"] == "soft_close"
        assert template["structure"] == ["hook", "closer"]

    def test_empty_content_has_sane_defaults(self):
        template = extract_template("")
        assert template["structure"] == ["hook", "closer"]
        assert template["platform"] == "unknown"


class TestApplyTemplate:
    def test_theme_substitution(self):
        template = {
            "hook_style": "question_hook",
            "structure": ["hook", "body", "cta"],
            "cta_style": "link_cta",
            "tone_notes": "notes",
            "platform": "twitter",
        }
        result = apply_template(template, "dog training")
        assert result["theme"] == "dog training"
        assert result["structure"] == ["hook", "body", "cta"]
        assert len(result["outline"]) == 3
        assert all("dog training" in line for line in result["outline"])
        assert "dog training" in result["caption_draft_notes"]
        assert "question_hook" in result["caption_draft_notes"]

    def test_business_context_appended(self):
        template = {"structure": ["hook", "cta"]}
        result = apply_template(template, "sourdough", "Bakery in Austin")
        assert "Bakery in Austin" in result["caption_draft_notes"]

    def test_non_dict_template_falls_back(self):
        result = apply_template("not-a-dict", "yoga")
        assert result["structure"] == ["hook", "body", "cta"]
        assert "yoga" in result["caption_draft_notes"]


class TestGetPostMetrics:
    def test_sums_across_snapshots(self, analytics_db):
        metrics = get_post_metrics(analytics_db, "p1")
        assert metrics["likes"] == 2000
        assert metrics["comments"] == 300
        assert metrics["shares"] == 200
        assert metrics["views"] == 50000

    def test_unknown_post_returns_zeros(self, analytics_db):
        assert get_post_metrics(analytics_db, "nope") == {
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "views": 0,
            "reach": 0,
            "impressions": 0,
        }

    def test_missing_tables_return_zeros(self, tmp_path):
        empty = sqlite3.connect(str(tmp_path / "empty.db"))
        try:
            assert get_post_metrics(empty, "p1")["likes"] == 0
        finally:
            empty.close()


class TestBestPosts:
    def test_ranked_by_engagement_rate(self, analytics_db):
        posts = best_posts(analytics_db, days=7)
        ids = [p["id"] for p in posts]
        assert ids[:3] == ["p1", "p2", "p3"]
        assert posts[0]["engagement_rate"] == 5.0
        for post in posts:
            assert {"id", "content", "platform", "published_at",
                    "metrics", "engagement_rate"} <= set(post)

    def test_excludes_old_and_pending_posts(self, analytics_db):
        posts = best_posts(analytics_db, days=7, limit=20)
        ids = {p["id"] for p in posts}
        assert "p_old" not in ids
        assert "p_pending" not in ids

    def test_platform_filter(self, analytics_db):
        posts = best_posts(analytics_db, days=7, platform="linkedin")
        assert [p["id"] for p in posts] == ["p2"]

    def test_limit(self, analytics_db):
        assert len(best_posts(analytics_db, days=7, limit=1)) == 1

    def test_missing_tables_return_empty(self, tmp_path):
        empty = sqlite3.connect(str(tmp_path / "empty.db"))
        try:
            assert best_posts(empty, days=7) == []
        finally:
            empty.close()


class TestDestructurePost:
    def test_template_from_stored_post(self, analytics_db):
        template = destructure_post(analytics_db, "p_template")
        assert template["post_id"] == "p_template"
        assert template["hook_style"] == "question_hook"
        assert template["cta_style"] == "link_cta"
        assert template["structure"] == ["hook", "body", "body", "cta"]
        assert template["platform"] == "twitter"

    def test_unknown_post_returns_error(self, analytics_db):
        assert "error" in destructure_post(analytics_db, "nope")


class TestResolveDbPath:
    def test_env_override(self, monkeypatch, tmp_path):
        monkeypatch.setenv("MAGICSYNC_DB_PATH", str(tmp_path / "custom.db"))
        assert resolve_db_path() == str(tmp_path / "custom.db")

    def test_default_points_at_repo_local_db(self, monkeypatch):
        monkeypatch.delenv("MAGICSYNC_DB_PATH", raising=False)
        assert resolve_db_path().endswith("local.db")


class TestAnalyticsToolsRegistered:
    def test_definitions_include_all_five(self):
        manager = ToolManager("test-user")
        names = {t["function"]["name"] for t in manager.get_tool_definitions()}
        assert {
            "virality_check",
            "engagement_calc",
            "best_posts",
            "destructure_post",
            "apply_template",
        } <= names

    def test_all_definitions_have_descriptions_and_params(self):
        manager = ToolManager("test-user")
        defs = {
            t["function"]["name"]: t["function"]
            for t in manager.get_tool_definitions()
        }
        for name in (
            "virality_check",
            "engagement_calc",
            "best_posts",
            "destructure_post",
            "apply_template",
        ):
            assert defs[name]["description"]
            assert defs[name]["parameters"]["type"] == "object"

    @pytest.mark.asyncio
    async def test_virality_check_requires_input(self):
        manager = ToolManager("test-user")
        assert "error" in await manager.execute_tool("virality_check", {})

    @pytest.mark.asyncio
    async def test_engagement_calc_requires_post_ids(self):
        manager = ToolManager("test-user")
        assert "error" in await manager.execute_tool("engagement_calc", {})

    @pytest.mark.asyncio
    async def test_destructure_requires_post_id(self):
        manager = ToolManager("test-user")
        assert "error" in await manager.execute_tool("destructure_post", {})

    @pytest.mark.asyncio
    async def test_apply_template_pure(self):
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "apply_template",
            {
                "template": {"hook_style": "question_hook",
                             "structure": ["hook", "cta"],
                             "cta_style": "link_cta"},
                "theme": "dog training",
            },
        )
        assert "error" not in result
        assert any("dog training" in line for line in result["outline"])

    @pytest.mark.asyncio
    async def test_apply_template_requires_theme(self):
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "apply_template", {"template": {}, "theme": ""}
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_best_posts_dispatch_against_tmp_db(self, monkeypatch):
        from app.services.analytics import nuxt as adapter

        async def fake_call(settings, path, payload):
            assert path == "/api/v1/internal/analytics/best-posts"
            assert payload["businessId"] == "biz-1"
            return {
                "posts": [
                    {"postId": "p1", "metrics": {"engagementRate": 5.0}},
                    {"postId": "p2", "metrics": {"engagementRate": 3.83}},
                ],
                "warnings": [],
                "version": "analytics/v1",
            }

        monkeypatch.setattr(adapter, "call_internal_analytics", fake_call)
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "best_posts", {"days": 7, "limit": 2, "business_id": "biz-1"}
        )
        assert "error" not in result
        assert result["count"] == 2
        assert result["posts"][0]["postId"] == "p1"
        assert result["source"] == "authoritative"

    @pytest.mark.asyncio
    async def test_engagement_calc_dispatch_against_tmp_db(self, monkeypatch):
        from app.services.analytics import nuxt as adapter

        async def fake_call(settings, path, payload):
            return {
                "rates": [{"postId": "p2", "engagementRate": 3.83}],
                "version": "analytics/v1",
            }

        monkeypatch.setattr(adapter, "call_internal_analytics", fake_call)
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "engagement_calc", {"post_ids": ["p2"], "business_id": "biz-1"}
        )
        assert "error" not in result
        assert result["results"][0]["engagement_rate"] == 3.83

    @pytest.mark.asyncio
    async def test_virality_check_dispatch_post_id(self, monkeypatch):
        from app.services.analytics import nuxt as adapter

        async def fake_call(settings, path, payload):
            return {
                "postId": "p1",
                "metrics": {"engagementRate": 5.0, "viralityScore": 71},
                "structure": {"hookStyle": "question", "blocks": [], "hashtagCount": 0, "charCount": 10},
                "explanation": "Measured",
                "warnings": [],
                "version": "analytics/v1",
            }

        monkeypatch.setattr(adapter, "call_internal_analytics", fake_call)
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "virality_check", {"post_id": "p1", "business_id": "biz-1"}
        )
        assert "error" not in result
        assert result["score"] == 71
        assert result["engagement_rate"] == 5.0

    @pytest.mark.asyncio
    async def test_virality_check_dispatch_content_only(self):
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "virality_check", {"content": "Hello world?"}
        )
        assert "error" not in result
        assert result["score"] is None
        assert "reason" in result

    @pytest.mark.asyncio
    async def test_destructure_dispatch_against_tmp_db(self, monkeypatch):
        from app.services.analytics import nuxt as adapter

        async def fake_call(settings, path, payload):
            return {
                "postId": "p_template",
                "metrics": {"engagementRate": 4.2, "viralityScore": 70},
                "structure": {"hookStyle": "question", "blocks": ["a", "b", "c", "d"], "hashtagCount": 1, "charCount": 50},
                "explanation": "Measured",
                "warnings": [],
                "version": "analytics/v1",
            }

        monkeypatch.setattr(adapter, "call_internal_analytics", fake_call)
        manager = ToolManager("test-user")
        result = await manager.execute_tool(
            "destructure_post", {"post_id": "p_template", "business_id": "biz-1"}
        )
        assert "error" not in result
        assert result["hook"]["style"] == "question"

    @pytest.mark.asyncio
    async def test_missing_db_file_returns_error(self, tmp_path, monkeypatch):
        monkeypatch.setenv(
            "MAGICSYNC_DB_PATH", str(tmp_path / "does-not-exist.db")
        )
        manager = ToolManager("test-user")
        assert "error" in await manager.execute_tool("best_posts", {})
        assert "error" in await manager.execute_tool(
            "engagement_calc", {"post_ids": ["p1"]}
        )
