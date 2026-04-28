import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "chess_app.db")


def init_db() -> None:
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON")

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clerk_user_id TEXT NOT NULL UNIQUE,
            email TEXT,
            display_name TEXT,
            bio TEXT,
            rating INTEGER DEFAULT 1200,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            games_played INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_clerk_id TEXT NOT NULL,
            opponent_name TEXT NOT NULL,
            opponent_type TEXT NOT NULL,
            result TEXT NOT NULL,
            rating_change INTEGER DEFAULT 0,
            difficulty TEXT DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_clerk_id) REFERENCES profiles(clerk_user_id)
        )
        """
    )

    # Migration: add difficulty column if it doesn't exist yet
    # (handles databases created before this fix)
    try:
        cursor.execute("ALTER TABLE games ADD COLUMN difficulty TEXT DEFAULT 'medium'")
        print("Migrated: added difficulty column to games table")
    except sqlite3.OperationalError:
        pass  # Column already exists, that's fine

    conn.commit()
    conn.close()
    print("Database initialized")


if __name__ == "__main__":
    init_db()