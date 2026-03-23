import sqlite3
from typing import Any, Optional


class DbConnection:

    def __init__(self, db_name: str="chess_app.db") -> None:
        self.db_name = db_name

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def get_user_by_username(self, username: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, username, email, password_hash, created_at, last_login
            FROM users
            WHERE username = ?
        """, (username,))

        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_profile_by_user_id(self, user_id: int) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, user_id, display_name, bio, rating, wins, losses, games_played
            FROM profiles
            WHERE user_id = ?
        """, (user_id,))

        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def update_last_login(self, user_id: int) -> None:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE users
            SET last_login = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (user_id,))

        conn.commit()
        conn.close()
