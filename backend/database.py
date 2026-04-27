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
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    # ------------------------------------------------------------------
    # Profile
    # ------------------------------------------------------------------

    def get_profile_by_clerk_user_id(self, clerk_user_id: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, clerk_user_id, email, display_name, bio,
                   rating, wins, losses, games_played, created_at
            FROM profiles WHERE clerk_user_id = ?
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
            (clerk_user_id, email, display_name, "New player"),
        )
        conn.commit()
        conn.close()

        profile = self.get_profile_by_clerk_user_id(clerk_user_id)
        if profile is None:
            raise ValueError("Failed to create profile")
        return profile

    def get_all_profiles(self) -> list[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT display_name, rating, wins, losses, games_played, clerk_user_id
            FROM profiles ORDER BY rating DESC
            """
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    # ------------------------------------------------------------------
    # Game recording
    # ------------------------------------------------------------------

    def record_game_result(
        self,
        clerk_user_id: str,
        opponent_name: str,
        opponent_type: str,
        result: str,           # "win" | "loss" | "draw"
        rating_change: int,
        difficulty: str,
    ) -> None:
        """Insert game row and update profile stats atomically."""
        conn = self._connect()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO games
                (player_clerk_id, opponent_name, opponent_type, result, rating_change, difficulty)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (clerk_user_id, opponent_name, opponent_type, result, rating_change, difficulty),
        )

        if result == "win":
            cursor.execute(
                """
                UPDATE profiles
                SET wins = wins + 1,
                    games_played = games_played + 1,
                    rating = MAX(0, rating + ?)
                WHERE clerk_user_id = ?
                """,
                (rating_change, clerk_user_id),
            )
        elif result == "loss":
            cursor.execute(
                """
                UPDATE profiles
                SET losses = losses + 1,
                    games_played = games_played + 1,
                    rating = MAX(0, rating + ?)
                WHERE clerk_user_id = ?
                """,
                (rating_change, clerk_user_id),
            )
        else:  # draw
            cursor.execute(
                """
                UPDATE profiles
                SET games_played = games_played + 1,
                    rating = MAX(0, rating + ?)
                WHERE clerk_user_id = ?
                """,
                (rating_change, clerk_user_id),
            )

        conn.commit()
        conn.close()

    # ------------------------------------------------------------------
    # Game history
    # ------------------------------------------------------------------

    def get_recent_games(self, player_clerk_id: str, limit: int = 10) -> list[dict[str, Any]]:
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT opponent_name, opponent_type, result, rating_change, difficulty, created_at
            FROM games
            WHERE player_clerk_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (player_clerk_id, limit),
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    # ------------------------------------------------------------------
    # Analytics
    # ------------------------------------------------------------------

    def get_stats_by_difficulty(self, clerk_user_id: str) -> dict[str, Any]:
        """Win/loss/draw counts and avg rating change per difficulty level."""
        conn = self._connect()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                difficulty,
                COUNT(*)                                             AS games,
                SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END)   AS wins,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)   AS losses,
                SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END)   AS draws,
                ROUND(AVG(rating_change), 1)                        AS avg_rating_change
            FROM games
            WHERE player_clerk_id = ?
            GROUP BY difficulty
            """,
            (clerk_user_id,),
        )
        rows = cursor.fetchall()
        conn.close()

        breakdown: dict[str, Any] = {}
        for row in rows:
            d = dict(row)
            diff = d.pop("difficulty")
            d["win_rate"] = round(d["wins"] / d["games"] * 100) if d["games"] > 0 else 0
            breakdown[diff] = d

        # Fill zeros for any difficulty with no games yet
        for level in ("easy", "medium", "hard"):
            if level not in breakdown:
                breakdown[level] = {
                    "games": 0, "wins": 0, "losses": 0,
                    "draws": 0, "win_rate": 0, "avg_rating_change": 0,
                }

        return breakdown