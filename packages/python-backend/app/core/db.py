import logging
import os

logger = logging.getLogger(__name__)

NUXT_BASE_URL = os.getenv("NUXT_BASE_URL", "http://localhost:3000")

_db_connection = None


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
    
    async def acquire(self):
        """Return self as connection for async with."""
        return self
    
    async def execute(self, query: str, params: tuple = None):
        """Return mock data for tests."""
        return TursoResult([])
    
    async def close(self):
        pass


class DatabasePool:
    """Mock pool for tests."""
    
    async def acquire(self):
        return TursoConnection()
    
    async def close(self):
        pass


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