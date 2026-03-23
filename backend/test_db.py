import sqlite3

DB_NAME = "chess_app.db"


def print_rows(title: str, query: str) -> None:
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    print(f"\n--- {title} ---")
    for row in rows:
        print(row)


if __name__ == "__main__":
    print_rows(
        "users",
        "SELECT id, username, email, created_at, last_login FROM users"
    )

    print_rows(
        "profiles",
        "SELECT id, user_id, display_name, bio, rating, wins, losses, games_played FROM profiles"
    )
