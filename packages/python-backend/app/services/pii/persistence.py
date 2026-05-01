import sqlite3
import os
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent.parent / "pii_mappings.db"


def get_connection() -> sqlite3.Connection:
    """Get SQLite connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create PII mappings table if not exists."""
    conn = get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pii_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                pii_type TEXT NOT NULL,
                fake_value TEXT NOT NULL,
                original_value TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, pii_type, fake_value)
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_pii_mappings_user 
            ON pii_mappings(user_id)
        """)
        conn.commit()
    finally:
        conn.close()


def save_mapping(user_id: str, pii_type: str, fake_value: str, original: str):
    """Persist a PII mapping to the database."""
    conn = get_connection()
    try:
        conn.execute("""
            INSERT OR REPLACE INTO pii_mappings (user_id, pii_type, fake_value, original_value)
            VALUES (?, ?, ?, ?)
        """, (user_id, pii_type, fake_value.lower(), original))
        conn.commit()
    finally:
        conn.close()


def load_mappings(user_id: str) -> dict[str, dict[str, str]]:
    """Load all mappings for a user from database."""
    conn = get_connection()
    try:
        cursor = conn.execute("""
            SELECT pii_type, fake_value, original_value
            FROM pii_mappings
            WHERE user_id = ?
        """, (user_id,))
        
        mappings: dict[str, dict[str, str]] = {}
        for row in cursor.fetchall():
            pii_type = row["pii_type"]
            if pii_type not in mappings:
                mappings[pii_type] = {}
            mappings[pii_type][row["fake_value"].lower()] = row["original_value"]
        
        return mappings
    finally:
        conn.close()


def clear_mappings(user_id: str):
    """Remove all mappings for a user from database."""
    conn = get_connection()
    try:
        conn.execute("DELETE FROM pii_mappings WHERE user_id = ?", (user_id,))
        conn.commit()
    finally:
        conn.close()


# Initialize DB on module load
init_db()
