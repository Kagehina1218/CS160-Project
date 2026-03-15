import sqlite3

def initialize_database():
    conn = sqlite3.connect("chess_app.db")
    cursor = conn.cursor()
    
    cursor.execute("""
                   CREATE TABLE IF NOT EXISTS users (
                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                       username TEXT UNIQUE NOT NULL,
                       password TEXT NOT NULL
                   )
                   """)
    
    # Insert a test user
    cursor.execute("""
                   INSERT INTO users (username, password)
                   VALUES (?, ?)
                   """, ("testuser", "testpassword"))
    
    conn.commit()
    conn.close()
    
    print("Database initialized")
    
if __name__ == "__main__":
    initialize_database()