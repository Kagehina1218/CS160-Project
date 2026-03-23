from flask import Flask, request, jsonify
from flask_cors import CORS

from auth import AuthService
from database import DbConnection

app = Flask(__name__)
CORS(app)

auth_service = AuthService()
db = DbConnection()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"message": "Missing JSON body"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    result = auth_service.authenticate(username, password)

    if not result["success"]:
        return jsonify({"message": result["message"]}), 401

    return jsonify(result), 200


@app.route("/profile/<int:user_id>", methods=["GET"])
def get_profile(user_id: int):
    profile = db.get_profile_by_user_id(user_id)

    if not profile:
        return jsonify({"message": "Profile not found"}), 404

    return jsonify(profile), 200


if __name__ == "__main__":
    app.run(debug=True)
