from flask import Flask, jsonify, request
from flask_cors import CORS

from backend.clerk_auth import extract_bearer_token, verify_clerk_token
from backend.database import DbConnection

import chess

app = Flask(__name__)
CORS(app)

db = DbConnection()

board = chess.Board()

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/profile", methods=["GET"])
def get_profile():
    try:
        token = extract_bearer_token(request)
        claims = verify_clerk_token(token)

        clerk_user_id = claims.get("sub")
        if not clerk_user_id:
            return jsonify({"message": "Missing Clerk user id"}), 401

        email = claims.get("email")
        display_name = claims.get("name") or claims.get("given_name")

        profile = db.create_profile_if_missing(
            clerk_user_id=clerk_user_id,
            email=email,
            display_name=display_name,
        )

        return jsonify({"profile": profile}), 200

    except Exception as exc:
        return jsonify({"message": str(exc)}), 401
    
@app.route("/leaderboard", methods=["GET"])
def get_leaderboard():
    try:
        token = extract_bearer_token(request)
        claims = verify_clerk_token(token)

        clerk_user_id = claims.get("sub")

        profiles = db.get_all_profiles()

        leaderboard = []

        for index, profile in enumerate(profiles, start=1):
            leaderboard.append({
                "rank": index,
                "name": profile.get("display_name") or "Player",
                "rating": profile.get("rating", 1200),
                "wins": profile.get("wins", 0),
                "losses": profile.get("losses", 0),
                "games_played": profile.get("games_played", 0),
                "is_current_user": profile.get("clerk_user_id") == clerk_user_id,
            })

        return jsonify({"leaderboard": leaderboard}), 200

    except Exception as exc:
        return jsonify({"message": str(exc)}), 401

@app.route("/games", methods=["GET"])
def get_games():
    try:
        token = extract_bearer_token(request)
        claims = verify_clerk_token(token)

        clerk_user_id = claims.get("sub")

        games = db.get_recent_games(clerk_user_id)

        return jsonify({"games": games}), 200

    except Exception as exc:
        return jsonify({"message": str(exc)}), 401
    
@app.route("/board", methods=["GET"])
def get_board():
    return jsonify({
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "is_checkmate": board.is_checkmate()
    })

@app.route("/move", methods=["POST"])
def make_move():
    data = request.get_json()
    move = data.get("move")

    try:
        chess_move = chess.Move.from_uci(move)
        if chess_move in board.legal_moves:
            captured = board.is_capture(chess_move)
            board.push(chess_move)

            return jsonify({
                "status": "ok",
                "fen": board.fen(),
                "turn": "white" if board.turn else "black",
                "capture": captured,
                "is_checkmate": board.is_checkmate()
            })
        else:
            return jsonify({"status": "illegal"})
    except:
        return jsonify({"status": "error"})

@app.route("/reset", methods=["POST"])
def reset():
    board.reset()
    return jsonify({"fen": board.fen()})

if __name__ == "__main__":
    app.run(debug=True)
