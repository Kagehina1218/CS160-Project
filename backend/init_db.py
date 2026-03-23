import sqlite3
from werkzeug.security import generate_password_hash

DB_NAME = "chess_app.db"


def init_db() -> None:
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON")

    # USERS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    """)

    # PROFILES TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            display_name TEXT,
            bio TEXT,
            rating INTEGER DEFAULT 1200,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            games_played INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Seed demo user
    cursor.execute("SELECT id FROM users WHERE username = ?", ("testuser",))
    existing_user = cursor.fetchone()

    if existing_user is None:
        password_hash = generate_password_hash("testpassword")

        cursor.execute("""
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        """, ("testuser", "testuser@example.com", password_hash))

        user_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO profiles (user_id, display_name, bio)
            VALUES (?, ?, ?)
        """, (user_id, "Test User", "Demo account for login testing"))
    else:
        user_id = existing_user[0]

        cursor.execute("SELECT id FROM profiles WHERE user_id = ?", (user_id,))
        existing_profile = cursor.fetchone()

        if existing_profile is None:
            cursor.execute("""
                INSERT INTO profiles (user_id, display_name, bio)
                VALUES (?, ?, ?)
            """, (user_id, "Test User", "Demo account for login testing"))

    conn.commit()
    conn.close()
    print("Database initialized")


if __name__ == "__main__":
    init_db()
