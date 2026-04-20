from flask import Flask, jsonify, request
from flask_cors import CORS

from clerk_auth import extract_bearer_token, verify_clerk_token
from database import DbConnection

import os
import json
import chess
from datetime import datetime

MESSAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "messages")
VALID_DIFFICULTIES = {"easy", "medium", "hard"}


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
    
@app.route("/messages/<difficulty>", methods=["GET"])
def get_messages(difficulty):
    try:
        token = extract_bearer_token(request)
        verify_clerk_token(token)
        
        messages = load_messages(difficulty)
        return jsonify({"messages": messages}), 200
    
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401
    
@app.route("/messages/<difficulty>", methods=["POST"])
def post_message(difficulty):
    try:
        token = extract_bearer_token(request)
        claims = verify_clerk_token(token)

        data = request.get_json()
        if not data:
            return jsonify({"message": "Invalid JSON body"}), 400
        
        message_text = (data.get("message") or "").strip()
        if not message_text:
            return jsonify({"message": "Message cannot be empty"}), 400 
        if len(message_text) > 300:
            return jsonify({"message": "Message too long (must be under 300 characters)"}), 400
        
        profile = db.create_profile_if_missing(
            clerk_user_id=claims.get("sub"),
            email=claims.get("email"),
            display_name=claims.get("name") or claims.get("given_name"),
        )
        
        messages = load_messages(difficulty)
        
        new_message = {
            "id": len(messages) + 1,
            "username": profile.get("display_name") or "Player",
            "clerk_user_id": claims.get("sub"),
            "message": message_text,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        
        messages.append(new_message)
        save_messages(difficulty, messages)
        
        return jsonify({
            "message": "Message posted successfully",
            "posted_message": new_message,
            "messages": messages
        }), 201
    
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401
    
def get_messages_file_path(difficulty: str) -> str:
    if difficulty not in VALID_DIFFICULTIES:
        raise ValueError("Invalid difficulty")

    os.makedirs(MESSAGES_DIR, exist_ok=True)
    return os.path.join(MESSAGES_DIR, f"{difficulty}.json")
    
def load_messages(difficulty: str):
    file_path = get_messages_file_path(difficulty)
    
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump([], f)

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_messages(difficulty: str, messages):
    file_path = get_messages_file_path(difficulty)
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2)

    
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
            board.push(chess_move)

            return jsonify({
                "status": "ok",
                "fen": board.fen(),
                "turn": "white" if board.turn else "black",
                "is_checkmate": board.is_checkmate()
            })
        else:
            return jsonify({"status": "illegal"})
    except:
        return jsonify({"status": "error"})

@app.route("/legal-moves/<square_name>", methods=["GET"])
def get_legal_moves(square_name):
    try:
        from_square = chess.parse_square(square_name)
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid square"}), 400

    piece = board.piece_at(from_square)
    if not piece:
        return jsonify({"status": "ok", "moves": []}), 200

    # Only show moves for the side whose turn it is
    if piece.color != board.turn:
        return jsonify({"status": "ok", "moves": []}), 200

    legal_destinations = []

    for move in board.legal_moves:
        if move.from_square == from_square:
            legal_destinations.append(chess.square_name(move.to_square))

    return jsonify({
        "status": "ok",
        "from": square_name,
        "moves": legal_destinations,
    }), 200

@app.route("/reset", methods=["POST"])
def reset():
    board.reset()
    return jsonify({"fen": board.fen()})

if __name__ == "__main__":
    app.run(debug=True)
