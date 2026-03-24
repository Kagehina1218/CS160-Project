import sqlite3
from typing import Any, Optional


class DbConnection:

    def __init__(self, db_name: str="chess_app.db") -> None:
        self.db_name = db_name

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        return conn

    def get_profile_by_clerk_user_id(self, clerk_user_id: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, clerk_user_id, email, display_name, bio, rating, wins, losses, games_played, created_at
            FROM profiles
            WHERE clerk_user_id = ?
        """, (clerk_user_id,))

        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def create_profile_if_missing(
        self,
        clerk_user_id: str,
        email: Optional[str],
        display_name: Optional[str],
    ) -> dict[str, Any]:
        existing = self.get_profile_by_clerk_user_id(clerk_user_id)
        if existing:
            return existing

        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO profiles (clerk_user_id, email, display_name, bio)
            VALUES (?, ?, ?, ?)
        """, (
            clerk_user_id,
            email,
            display_name,
            "New Clerk user",
        ))

        conn.commit()
        conn.close()

        profile = self.get_profile_by_clerk_user_id(clerk_user_id)
        if profile is None:
            raise ValueError("Failed to create profile")
        return profile
