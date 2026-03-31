import pytest
from unittest.mock import AsyncMock, patch


class TestValidateSQL:
    """Test SQL validation — blocks dangerous queries, allows safe SELECTs."""

    def test_select_query_is_valid(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("SELECT * FROM posts WHERE user_id = ?")
        assert is_valid is True
        assert error == ""

    def test_select_with_join_is_valid(self):
        from app.services.tools import text_to_sql_service
        sql = "SELECT p.content, b.name FROM posts p JOIN business_profiles b ON p.business_id = b.id WHERE p.user_id = ?"
        is_valid, error = text_to_sql_service.validate_sql(sql)
        assert is_valid is True

    def test_insert_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("INSERT INTO posts (content) VALUES ('hack')")
        assert is_valid is False

    def test_update_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("UPDATE posts SET content = 'hacked' WHERE id = 1")
        assert is_valid is False

    def test_delete_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("DELETE FROM posts WHERE id = 1")
        assert is_valid is False

    def test_drop_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("DROP TABLE posts")
        assert is_valid is False

    def test_alter_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("ALTER TABLE posts ADD COLUMN hack TEXT")
        assert is_valid is False

    def test_pragma_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("PRAGMA table_info(posts)")
        assert is_valid is False

    def test_sql_comment_injection_is_blocked(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("SELECT * FROM posts -- WHERE user_id = ?")
        assert is_valid is False

    def test_whitespace_before_select_is_valid(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("  \n  SELECT * FROM posts")
        assert is_valid is True

    def test_empty_query_is_invalid(self):
        from app.services.tools import text_to_sql_service
        is_valid, error = text_to_sql_service.validate_sql("")
        assert is_valid is False


class TestParseResponse:
    """Test LLM response parsing into structured SQL output."""

    def test_parses_valid_json_response(self):
        from app.services.tools import text_to_sql_service
        content = '{"sql": "SELECT * FROM posts", "explanation": "All posts", "tables_used": ["posts"]}'
        result = text_to_sql_service._parse_response(content)
        assert result["sql"] == "SELECT * FROM posts"
        assert result["explanation"] == "All posts"
        assert result["tables_used"] == ["posts"]

    def test_parses_json_with_markdown_fences(self):
        from app.services.tools import text_to_sql_service
        content = '```json\n{"sql": "SELECT * FROM posts", "explanation": "test", "tables_used": ["posts"]}\n```'
        result = text_to_sql_service._parse_response(content)
        assert result["sql"] == "SELECT * FROM posts"

    def test_parses_json_with_plain_fences(self):
        from app.services.tools import text_to_sql_service
        content = '```\n{"sql": "SELECT * FROM posts", "explanation": "test", "tables_used": ["posts"]}\n```'
        result = text_to_sql_service._parse_response(content)
        assert result["sql"] == "SELECT * FROM posts"

    def test_extracts_sql_from_plain_text(self):
        from app.services.tools import text_to_sql_service
        content = "Here is your query:\nSELECT * FROM posts WHERE user_id = ?;\nThis selects all posts."
        result = text_to_sql_service._parse_response(content)
        assert "SELECT" in result["sql"]

    def test_returns_empty_on_invalid_response(self):
        from app.services.tools import text_to_sql_service
        content = "I cannot generate SQL for that query."
        result = text_to_sql_service._parse_response(content)
        assert result["sql"] == ""
        assert result["explanation"] == "I cannot generate SQL for that query."


class TestGenerateSQL:
    """Test SQL generation from natural language via LLM."""

    @pytest.mark.asyncio
    async def test_returns_sql_on_success(self):
        from app.services.tools import text_to_sql_service

        mock_response = {
            "message": {
                "content": '{"sql": "SELECT COUNT(*) as total FROM posts WHERE user_id = ?", "explanation": "Count all posts", "tables_used": ["posts"]}'
            }
        }

        with patch(
            "app.services.tools.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await text_to_sql_service.generate_sql("How many posts do I have?")
            assert result["sql"] == "SELECT COUNT(*) as total FROM posts WHERE user_id = ?"
            assert result["explanation"] == "Count all posts"
            assert "posts" in result["tables_used"]

    @pytest.mark.asyncio
    async def test_handles_llm_error_gracefully(self):
        from app.services.tools import text_to_sql_service

        with patch(
            "app.services.tools.ollama_service.chat_complete",
            new_callable=AsyncMock,
            side_effect=Exception("Ollama unavailable"),
        ):
            result = await text_to_sql_service.generate_sql("test query")
            assert result["sql"] == ""
            assert "Failed" in result["explanation"]

    @pytest.mark.asyncio
    async def test_uses_custom_model(self):
        from app.services.tools import text_to_sql_service

        mock_response = {
            "message": {
                "content": '{"sql": "SELECT 1", "explanation": "test", "tables_used": []}'
            }
        }

        with patch(
            "app.services.tools.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ) as mock_llm:
            await text_to_sql_service.generate_sql("test", model="custom-model")
            call_kwargs = mock_llm.call_args.kwargs
            assert call_kwargs["model"] == "custom-model"


class TestTextToSQLEndpoint:
    """Test the /tools/text-to-sql API endpoint."""

    def test_generate_sql_endpoint(self, client, api_prefix):
        mock_response = {
            "message": {
                "content": '{"sql": "SELECT * FROM posts WHERE user_id = ?", "explanation": "All posts", "tables_used": ["posts"]}'
            }
        }

        with patch(
            "app.services.tools.ollama_service.chat_complete",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = client.post(
                f"{api_prefix}/tools/text-to-sql",
                json={"query": "show me all posts"},
                headers={"Authorization": "Bearer test-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["query"] == "show me all posts"
            assert "SELECT" in data["sql"]

    def test_generate_sql_empty_query_rejected(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/tools/text-to-sql",
            json={"query": ""},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code in (400, 422)

    def test_generate_sql_no_query_rejected(self, client, api_prefix):
        response = client.post(
            f"{api_prefix}/tools/text-to-sql",
            json={},
            headers={"Authorization": "Bearer test-token"},
        )
        assert response.status_code in (400, 422)
