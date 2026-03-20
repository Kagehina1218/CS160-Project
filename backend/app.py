from flask import Flask, request, jsonify
from flask_cors import CORS
from auth import AuthService

app = Flask(__name__)
CORS(app)

auth_service = AuthService()

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and password are required."
        }), 400

    if auth_service.authenticate(username, password):
        return jsonify({
            "success": True,
            "message": "Login successful."
        }), 200

    return jsonify({
        "success": False,
        "message": "Invalid username or password."
    }), 401

if __name__ == "__main__":
    app.run(debug=True)