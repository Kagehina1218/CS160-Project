import sqlite3

DB_NAME = "backend/chess_app.db"

class DbConnection:
    """Handles communication with the SQLite database"""
    
    def connect(self):
        return sqlite3.connect(DB_NAME)
    
    def get_user_by_username(self, username):
        conn = self.connect()
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT id, username, password FROM users WHERE username = ?", 
            (username,)
            )
        
        user = cursor.fetchone()
        conn.close()
        return user    