import logging
import os
import sqlite3
import asyncio
from contextlib import asynccontextmanager
from typing import Any

logger = logging.getLogger(__name__)

NUXT_BASE_URL = os.getenv("NUXT_BASE_URL", "http://localhost:3000")

# SQLite database path - can be overridden for testing
DB_PATH = os.getenv("SQLITE_DB_PATH", "/tmp/magicsync.db")

# Test mode flag - when True, use mock connections
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"

_db_connection: "DatabasePool | None" = None


class TursoResult:
    """Mock result for test compatibility."""

    def __init__(self, rows: list = None, columns: list = None):
        self._rows = rows or []
        self._columns = columns or []

    @property
    def rows(self):
        return self._rows

    @property
    def columns(self):
        return self._columns

    def one_or_none(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


class TursoConnection:
    """Connection wrapper - mock for testing."""

    async def __aenter__(self):
        """Support async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit async context manager."""
        pass

    async def acquire(self):
        """Return self as connection for async with."""
        return self

    async def execute(self, query: str, params: tuple = None):
        """Return mock data for tests."""
        return TursoResult([])

    async def close(self):
        pass


class SQLiteConnection:
    """Real SQLite async connection wrapper."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn
        self._loop = asyncio.get_event_loop()

    async def __aenter__(self):
        """Support async context manager."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Exit async context manager."""
        pass

    @asynccontextmanager
    async def acquire(self):
        """Context manager to return self as connection."""
        yield self

    async def execute(self, query: str, params: tuple = None) -> TursoResult:
        """Execute a query and return results."""
        try:
            cursor = self._conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)

            # For SELECT queries, return results
            if query.strip().upper().startswith("SELECT"):
                rows = cursor.fetchall()
                columns = [description[0] for description in cursor.description] if cursor.description else []
                return TursoResult(rows=rows, columns=columns)
            else:
                # For INSERT/UPDATE/DELETE, commit and return
                self._conn.commit()
                return TursoResult(rows=[], columns=[])
        except Exception as e:
            logger.error(f"SQLite execute error: {e}")
            self._conn.rollback()
            raise

    async def close(self):
        """Close the connection."""
        self._conn.close()


class DatabasePool:
    """Database pool - real SQLite or mock for tests."""

    def __init__(self, db_path: str = DB_PATH):
        self._db_path = db_path
        self._conn: sqlite3.Connection | None = None

    def acquire(self) -> SQLiteConnection | TursoConnection:
        """Acquire a connection from the pool."""
        if TEST_MODE:
            return TursoConnection()

        if self._conn is None:
            # Create SQLite connection with dict-like row factory
            self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row

        return SQLiteConnection(self._conn)

    async def close(self):
        """Close the pool."""
        if self._conn:
            self._conn.close()
            self._conn = None


async def get_db_pool() -> DatabasePool:
    """Get database pool."""
    global _db_connection

    if _db_connection is None:
        _db_connection = DatabasePool()

    return _db_connection


async def init_db():
    """Initialize database connection (alias for get_db_pool)."""
    return await get_db_pool()


async def close_db():
    """Close database connection."""
    global _db_connection

    if _db_connection:
        await _db_connection.close()
        _db_connection = None


async def ensure_sub_agents_table():
    """Create the sub_agents table if it doesn't exist."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS sub_agents (
                agent_id TEXT PRIMARY KEY,
                task TEXT NOT NULL,
                parent_message_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'created',
                messages TEXT NOT NULL DEFAULT '[]',
                result TEXT,
                error TEXT,
                max_steps INTEGER NOT NULL DEFAULT 10,
                step_count INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        """)
        # Create index for faster user_id lookups
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sub_agents_user_id ON sub_agents(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sub_agents_parent_message_id ON sub_agents(parent_message_id)
        """)