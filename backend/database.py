import os
import sqlite3
from typing import Any, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "chess_app.db")


class DbConnection:
    def __init__(self, db_name: str = DB_PATH) -> None:
        self.db_name = db_name

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_name)
        conn.row_factory = sqlite3.Row
        return conn

    def get_profile_by_clerk_user_id(self, clerk_user_id: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT id, clerk_user_id, email, display_name, bio, rating, wins, losses, games_played, created_at
            FROM profiles
            WHERE clerk_user_id = ?
            """,
            (clerk_user_id,),
        )

        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_leaderboard_entry_by_clerk_user_id(self, clerk_user_id: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT clerk_user_id, display_name, rating, wins, losses, games_played
            FROM profiles
            WHERE clerk_user_id = ?
            """,
            (clerk_user_id,),
        )

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

        cursor.execute(
            """
            INSERT INTO profiles (clerk_user_id, email, display_name, bio)
            VALUES (?, ?, ?, ?)
            """,
            (
                clerk_user_id,
                email,
                display_name,
                "New Clerk user",
            ),
        )

        conn.commit()
        conn.close()

        profile = self.get_profile_by_clerk_user_id(clerk_user_id)
        if profile is None:
            raise ValueError("Failed to create profile")
        return profile

    def add_game(
        self,
        player_clerk_id: str,
        opponent_name: str,
        opponent_type: str,
        result: str,
        rating_change: int,
    ) -> None:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO games (player_clerk_id, opponent_name, opponent_type, result, rating_change)
            VALUES (?, ?, ?, ?, ?)
            """,
            (player_clerk_id, opponent_name, opponent_type, result, rating_change),
        )

        conn.commit()
        conn.close()

    def get_recent_games(self, player_clerk_id: str) -> list[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT opponent_name, opponent_type, result, rating_change, created_at
            FROM games
            WHERE player_clerk_id = ?
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (player_clerk_id,),
        )

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]
    
    def get_all_profiles(self):
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute("""
        SELECT display_name, rating, wins, losses, games_played, clerk_user_id
        FROM profiles
        ORDER BY rating DESC
    """)

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]