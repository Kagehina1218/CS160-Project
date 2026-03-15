from database import DbConnection

class AuthService:
    """Handles login authentication"""
    
    def __init__(self):
        self.db = DbConnection()
        
    def authenticate(self, username, password):
        user = self.db.get_user_by_username(username)
        
        if user is None:
            return False
        
        stored_password = user[2]  # Assuming password is the third column
        return stored_password == password