import sqlite3
from database import DB_NAME

def initialize_database():
    conn = sqlite3.connect(DB_NAME)
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
                   INSERT OR IGNORE INTO users (username, password)
                   VALUES (?, ?)
                   """, ("testuser", "testpassword"))
    
    conn.commit()
    conn.close()
    
    print("Database initialized")
    
if __name__ == "__main__":
    initialize_database()