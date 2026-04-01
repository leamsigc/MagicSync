import logging
import re
from app.services.llm import llm_service

logger = logging.getLogger(__name__)

# MagicSync database schema context for the LLM
MAGISCSYNC_SCHEMA = """
Database: SQLite (Turso libSQL)

Tables:

1. user (id TEXT PK, name TEXT, email TEXT UNIQUE, email_verified INTEGER, image TEXT, created_at INTEGER, updated_at INTEGER)

2. business_profiles (id TEXT PK, user_id TEXT FK->user, google_business_id TEXT, name TEXT, description TEXT, address TEXT, phone TEXT, website TEXT, category TEXT, is_active INTEGER, created_at INTEGER, updated_at INTEGER)

3. social_media_accounts (id TEXT PK, user_id TEXT FK->user, business_id TEXT FK->business_profiles, platform TEXT ENUM(facebook,instagram,instagram-standalone,twitter,tiktok,google,googlemybusiness,discord,linkedin,linkedin-page,threads,youtube,bluesky,devto,dribbble,reddit,wordpress), account_id TEXT, account_name TEXT, access_token TEXT, refresh_token TEXT, token_expires_at INTEGER, is_active INTEGER, last_sync_at INTEGER, entity_detail_id TEXT, created_at INTEGER, updated_at INTEGER)

4. social_media_account_managers (social_media_account_id TEXT FK->social_media_accounts, user_id TEXT FK->user, created_at INTEGER, updated_at INTEGER)

5. posts (id TEXT PK, user_id TEXT FK->user, business_id TEXT FK->business_profiles, content TEXT, media_assets TEXT, scheduled_at INTEGER, published_at INTEGER, status TEXT ENUM(pending,published,failed), target_platforms TEXT, platform_content TEXT JSON, platform_settings TEXT JSON, post_format TEXT ENUM(post,reel,story,short), created_at INTEGER, updated_at INTEGER)

6. platform_posts (id TEXT PK, post_id TEXT FK->posts, social_account_id TEXT FK->social_media_accounts, platform_post_id TEXT, status TEXT ENUM(pending,published,failed), error_message TEXT, platform_settings TEXT JSON, publish_detail TEXT JSON, published_at INTEGER, created_at INTEGER)

7. assets (id TEXT PK, user_id TEXT FK->user, business_id TEXT FK->business_profiles, filename TEXT, original_name TEXT, mime_type TEXT, size INTEGER, url TEXT, thumbnail_url TEXT, metadata TEXT JSON, is_public INTEGER, created_at INTEGER)

8. business_reviews (id TEXT PK, business_id TEXT FK->business_profiles, platform TEXT, external_id TEXT, reviewer_name TEXT, rating INTEGER, comment TEXT, reply TEXT, replied_at INTEGER, review_date INTEGER, is_analyzed INTEGER, created_at INTEGER)

9. subscriptions (id TEXT PK, user_id TEXT FK->user, plan TEXT ENUM(free,pro,enterprise), status TEXT ENUM(active,cancelled,expired), stripe_subscription_id TEXT, current_period_start INTEGER, current_period_end INTEGER, created_at INTEGER, updated_at INTEGER)

10. notifications (id TEXT PK, user_id TEXT FK->user, type TEXT, title TEXT, message TEXT, is_read INTEGER, metadata TEXT JSON, created_at INTEGER)

11. templates (id TEXT PK, owner_id TEXT FK->user, name TEXT, description TEXT, content TEXT, category TEXT, is_public INTEGER, created_at INTEGER, updated_at INTEGER)

12. template_assets (id TEXT PK, template_id TEXT FK->templates, asset_id TEXT, display_order INTEGER, created_at INTEGER)

13. documents (id TEXT PK, user_id TEXT FK->user, filename TEXT, original_name TEXT, mime_type TEXT, size INTEGER, storage_path TEXT, content_hash TEXT, status TEXT ENUM(pending,processing,completed,failed), error_message TEXT, chunk_count INTEGER, metadata TEXT JSON, created_at INTEGER, updated_at INTEGER)

14. document_chunks (id TEXT PK, document_id TEXT FK->documents, user_id TEXT FK->user, chunk_index INTEGER, content TEXT, content_hash TEXT, embedding BLOB, token_count INTEGER, metadata TEXT JSON, created_at INTEGER)

15. chat_threads (id TEXT PK, user_id TEXT FK->user, title TEXT, last_message_at INTEGER, created_at INTEGER)

16. chat_messages (id TEXT PK, thread_id TEXT FK->chat_threads, user_id TEXT FK->user, role TEXT ENUM(user,assistant,system), content TEXT, metadata TEXT JSON, created_at INTEGER)

17. entity_details (id TEXT PK, entity_type TEXT, external_id TEXT, name TEXT, data TEXT JSON, synced_at INTEGER, created_at INTEGER)

Notes:
- All timestamps are Unix epoch integers (seconds since 1970-01-01)
- All IDs are TEXT UUIDs
- JSON fields stored as TEXT
- user_id columns always reference the user table
- Always filter by user_id for security
"""


class TextToSQLService:
    """Converts natural language queries to SQL using the LLM."""

    def get_schema_context(self, custom_context: str = "") -> str:
        """Get the database schema context for the LLM prompt."""
        if custom_context:
            return custom_context
        return MAGISCSYNC_SCHEMA

    async def generate_sql(
        self,
        query: str,
        schema_context: str = "",
        model: str | None = None,
    ) -> dict:
        """Generate SQL from a natural language query.

        Returns:
            dict with keys: sql, explanation, tables_used
        """
        schema = self.get_schema_context(schema_context)

        prompt = f"""You are a SQL expert for a SQLite database.

{schema}

Convert the following natural language query into a SQL SELECT statement.

Rules:
- Only generate SELECT queries (no INSERT, UPDATE, DELETE, DROP, ALTER, CREATE)
- Use SQLite syntax
- Use proper JOINs when querying across tables
- Always include WHERE user_id = ? for user-scoped tables (posts, assets, documents, chat_threads, chat_messages, social_media_accounts, business_profiles, subscriptions, notifications, templates)
- For timestamps stored as integers, use datetime(column, 'unixepoch') to convert to readable dates
- Keep queries simple and efficient
- Limit results to 100 rows by default

Natural language query: {query}

Respond with ONLY a JSON object (no markdown fences):
{{"sql": "SELECT ...", "explanation": "brief explanation", "tables_used": ["table1", "table2"]}}
"""

        try:
            response = await llm_service.chat_complete(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                temperature=0.1,
            )

            content = response.get("message", {}).get("content", "")
            return self._parse_response(content)
        except Exception as e:
            logger.error(f"Text-to-SQL generation failed: {e}")
            return {"sql": "", "explanation": f"Failed to generate SQL: {e}", "tables_used": []}

    def _parse_response(self, content: str) -> dict:
        """Parse the LLM response to extract SQL, explanation, and tables."""
        import json

        # Strip markdown fences if present
        content = content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n?", "", content)
            content = re.sub(r"\n?```$", "", content)

        try:
            data = json.loads(content.strip())
            return {
                "sql": data.get("sql", ""),
                "explanation": data.get("explanation", ""),
                "tables_used": data.get("tables_used", []),
            }
        except json.JSONDecodeError:
            # Try to extract SQL from the content directly
            sql_match = re.search(r"(SELECT\b.*?;)", content, re.IGNORECASE | re.DOTALL)
            if sql_match:
                return {
                    "sql": sql_match.group(1).strip().rstrip(";"),
                    "explanation": "",
                    "tables_used": [],
                }
            return {"sql": "", "explanation": content, "tables_used": []}

    def validate_sql(self, sql: str) -> tuple[bool, str]:
        """Validate that a SQL query is safe (SELECT-only).

        Returns:
            (is_valid, error_message)
        """
        sql_upper = sql.upper().strip()

        # Must start with SELECT
        if not sql_upper.startswith("SELECT"):
            return False, "Only SELECT queries are allowed"

        # Block SQL comments (injection vector)
        if "--" in sql or "/*" in sql or "*/" in sql:
            return False, "SQL comments are not allowed"

        # Block dangerous keywords
        dangerous = [
            "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
            "TRUNCATE", "REPLACE", "ATTACH", "DETACH", "PRAGMA",
            "EXEC", "EXECUTE",
        ]
        for keyword in dangerous:
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, sql_upper):
                return False, f"Keyword '{keyword}' is not allowed"

        return True, ""


text_to_sql_service = TextToSQLService()
