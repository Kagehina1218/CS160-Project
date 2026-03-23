from werkzeug.security import check_password_hash
from database import DbConnection


class AuthService:

    def __init__(self) -> None:
        self.db = DbConnection()

    def authenticate(self, username: str, password: str) -> dict:
        user = self.db.get_user_by_username(username)

        if not user:
            return {
                "success": False,
                "message": "User not found"
            }

        if not check_password_hash(user["password_hash"], password):
            return {
                "success": False,
                "message": "Invalid password"
            }

        self.db.update_last_login(user["id"])
        profile = self.db.get_profile_by_user_id(user["id"])

        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "display_name": profile["display_name"] if profile else user["username"]
            }
        }
