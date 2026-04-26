from flask import Flask, jsonify, request
from flask_cors import CORS

from clerk_auth import extract_bearer_token, verify_clerk_token
from database import DbConnection

from messages_service import load_messages, save_messages

from game_state import (
    board,
    active_augments,
    bishop_double_move_state,
    knight_bonus_move_state,
    clear_bishop_double_move_state,
    clear_knight_bonus_move_state,
    build_game_status_response,
    turn_count,
    increment_turn_count,
    reset_turn_count,
    get_turn_count,
)

from augments import (
    square_coords,
    get_piece_side,
    is_extended_knight_move,
    is_safe_custom_knight_move,
    is_safe_second_knight_move,
    is_safe_custom_bishop_move,
    is_safe_second_bishop_move,
    is_blocked_by_king_guard,
    is_safe_custom_king_stride,
    is_safe_king_destination,
)

from agent import get_ai_move

import os
import json
import chess
from datetime import datetime

app = Flask(__name__)
CORS(app)

db = DbConnection()

game_difficulty = "medium"


def _trigger_ai_move():
    if board.turn != chess.BLACK:
        return
    if board.is_game_over():
        return
    try:
        ai_uci = get_ai_move(board, game_difficulty)
        if not ai_uci:
            return
        ai_move = chess.Move.from_uci(ai_uci)
        if ai_move in board.legal_moves:
            board.push(ai_move)
            increment_turn_count()
    except Exception as e:
        print(f"AI move error: {e}")


def build_game_status_response_with_ai(message: str):
    _trigger_ai_move()
    return build_game_status_response(message)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/difficulty", methods=["GET"])
def get_difficulty():
    return jsonify({"difficulty": game_difficulty})


@app.route("/difficulty", methods=["POST"])
def set_difficulty():
    global game_difficulty
    data = request.get_json()
    difficulty = data.get("difficulty", "medium")
    if difficulty not in ("easy", "medium", "hard"):
        return jsonify({"status": "error", "message": "Invalid difficulty"}), 400
    game_difficulty = difficulty
    return jsonify({"status": "ok", "difficulty": game_difficulty})


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


@app.route("/board", methods=["GET"])
def get_board():
    is_checkmate = board.is_checkmate()
    is_stalemate = board.is_stalemate()

    winner = None
    if is_checkmate:
        winner = "black" if board.turn else "white"

    return jsonify({
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "is_checkmate": is_checkmate,
        "is_stalemate": is_stalemate,
        "winner": winner,
        "turn_count": get_turn_count(),
    })


@app.route("/move", methods=["POST"])
def make_move():
    data = request.get_json()
    move = data.get("move")

    try:
        chess_move = chess.Move.from_uci(move)
        piece = board.piece_at(chess_move.from_square)

        if not piece:
            return jsonify({"status": "illegal", "message": "No piece selected"})

        side = get_piece_side(piece)
        side_augments = active_augments[side]

        # King guard
        if is_blocked_by_king_guard(board, chess_move, side, active_augments):
            return jsonify({
                "status": "illegal",
                "message": "That square is protected by King Guard"
            })

        # Forced second bishop move
        if bishop_double_move_state["active"]:
            required_side = bishop_double_move_state["side"]
            required_square_name = bishop_double_move_state["bishop_square"]

            if side != required_side:
                return jsonify({
                    "status": "illegal",
                    "message": "Must complete bishop second move"
                })

            if chess.square_name(chess_move.from_square) != required_square_name:
                return jsonify({
                    "status": "illegal",
                    "message": "Must move the same bishop again"
                })

            if piece.piece_type != chess.BISHOP:
                return jsonify({
                    "status": "illegal",
                    "message": "Second move must be made by that bishop"
                })

            if not is_safe_second_bishop_move(board, chess_move):
                return jsonify({
                    "status": "illegal",
                    "message": "Second bishop move cannot capture"
                })

            board.push(chess_move)
            clear_bishop_double_move_state()

            return build_game_status_response_with_ai("Second bishop move completed")

        # Forced second knight move
        if knight_bonus_move_state["active"]:
            required_side = knight_bonus_move_state["side"]
            required_square_name = knight_bonus_move_state["knight_square"]

            if side != required_side:
                return jsonify({
                    "status": "illegal",
                    "message": "Must complete knight bonus move"
                })

            if chess.square_name(chess_move.from_square) != required_square_name:
                return jsonify({
                    "status": "illegal",
                    "message": "Must move the same knight again"
                })

            if piece.piece_type != chess.KNIGHT:
                return jsonify({
                    "status": "illegal",
                    "message": "Second move must be made by that knight"
                })

            if not is_safe_second_knight_move(board, chess_move):
                return jsonify({
                    "status": "illegal",
                    "message": "Illegal second knight move"
                })

            board.push(chess_move)
            clear_knight_bonus_move_state()

            return build_game_status_response_with_ai("Second knight move completed")

        # Standard legal move
        if chess_move in board.legal_moves:
            moving_piece_type = piece.piece_type
            destination_piece = board.piece_at(chess_move.to_square)
            was_capture = destination_piece is not None

            board.push(chess_move)

            # Bishop double move triggered
            if (
                side_augments["bishop_double_move"]
                and moving_piece_type == chess.BISHOP
                and not was_capture
            ):
                board.turn = not board.turn
                clear_knight_bonus_move_state()

                bishop_double_move_state["active"] = True
                bishop_double_move_state["side"] = side
                bishop_double_move_state["bishop_square"] = chess.square_name(chess_move.to_square)

                # AI does NOT move here — white still has a bonus move pending
                return build_game_status_response("Bishop may move again")

            # Bishop capture ends turn
            if (
                side_augments["bishop_double_move"]
                and moving_piece_type == chess.BISHOP
                and was_capture
            ):
                clear_bishop_double_move_state()
                clear_knight_bonus_move_state()

                return build_game_status_response_with_ai("Bishop capture ends turn")

            # Knight bonus move triggered after capture
            if (
                side_augments["knight_second_move_after_capture"]
                and moving_piece_type == chess.KNIGHT
                and was_capture
            ):
                board.turn = not board.turn
                clear_bishop_double_move_state()

                knight_bonus_move_state["active"] = True
                knight_bonus_move_state["side"] = side
                knight_bonus_move_state["knight_square"] = chess.square_name(chess_move.to_square)

                # AI does NOT move here — white still has a bonus move pending
                return build_game_status_response("Knight may move again")

            # Normal move — turn passes to black, AI fires
            clear_bishop_double_move_state()
            clear_knight_bonus_move_state()

            return build_game_status_response_with_ai("Move completed")

        # Knight augment: allow 4x1 movement
        if (
            side_augments["knight_long_jump"]
            and piece.piece_type == chess.KNIGHT
            and is_extended_knight_move(chess_move.from_square, chess_move.to_square)
            and is_safe_custom_knight_move(board, chess_move)
        ):
            board.remove_piece_at(chess_move.from_square)
            board.remove_piece_at(chess_move.to_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn

            return build_game_status_response_with_ai("Knight long jump completed")

        # Bishop augment: allow passing through exactly one piece
        if (
            side_augments["bishop_phase"]
            and piece.piece_type == chess.BISHOP
            and is_safe_custom_bishop_move(board, chess_move)
        ):
            board.remove_piece_at(chess_move.from_square)
            board.remove_piece_at(chess_move.to_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn

            return build_game_status_response_with_ai("Bishop phase completed")

        # King augment: allow moving up to 2 squares in any direction
        if (
            side_augments["king_stride"]
            and piece.piece_type == chess.KING
            and is_safe_custom_king_stride(board, chess_move)
        ):
            if is_blocked_by_king_guard(board, chess_move, side, active_augments):
                return jsonify({
                    "status": "illegal",
                    "message": "That square is protected by King Guard"
                })

            board.remove_piece_at(chess_move.from_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn

            clear_bishop_double_move_state()
            clear_knight_bonus_move_state()

            return build_game_status_response_with_ai("King stride completed")

        return jsonify({
            "status": "illegal",
            "message": "Illegal move"
        })

    except ValueError:
        return jsonify({"status": "error", "message": "Invalid move format"})
    except Exception as e:
        print("MOVE ERROR:", e)
        return jsonify({"status": "error", "message": str(e)})


@app.route("/legal-moves/<square_name>", methods=["GET"])
def get_legal_moves(square_name):
    if board.is_checkmate():
        winner = "black" if board.turn else "white"
        return jsonify({
            "status": "ok",
            "moves": [],
            "blocked_moves": [],
            "message": f"Checkmate - {winner.capitalize()} wins",
            "is_checkmate": True,
            "is_stalemate": False,
            "winner": winner,
        }), 200

    if board.is_stalemate():
        return jsonify({
            "status": "ok",
            "moves": [],
            "blocked_moves": [],
            "message": "Stalemate - Draw",
            "is_checkmate": False,
            "is_stalemate": True,
            "winner": None,
        }), 200

    try:
        from_square = chess.parse_square(square_name)
    except ValueError:
        return jsonify({
            "status": "error",
            "message": "Invalid square",
            "moves": [],
            "blocked_moves": [],
        }), 400

    piece = board.piece_at(from_square)
    if not piece:
        return jsonify({
            "status": "ok",
            "moves": [],
            "blocked_moves": [],
        }), 200

    side = get_piece_side(piece)

    # Forced second bishop move
    if bishop_double_move_state["active"]:
        required_side = bishop_double_move_state["side"]
        required_square_name = bishop_double_move_state["bishop_square"]

        if side != required_side:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

        if chess.square_name(from_square) != required_square_name:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

        legal_destinations = {}
        blocked_destinations = {}

        for move in board.legal_moves:
            if move.from_square != from_square or piece.piece_type != chess.BISHOP:
                continue

            to_square_name = chess.square_name(move.to_square)
            is_capture = board.piece_at(move.to_square) is not None

            if is_capture:
                blocked_destinations[to_square_name] = {
                    "square": to_square_name,
                    "reason": "second_bishop_move_no_capture",
                }
                continue

            if is_safe_second_bishop_move(board, move):
                legal_destinations[to_square_name] = {
                    "square": to_square_name,
                    "is_capture": False,
                }

        if len(legal_destinations) == 0:
            clear_bishop_double_move_state()
            board.turn = not board.turn

            return jsonify({
                "status": "ok",
                "from": square_name,
                "moves": [],
                "blocked_moves": [],
                "message": "No available bishop moves, turn skipped"
            }), 200

        return jsonify({
            "status": "ok",
            "from": square_name,
            "moves": [legal_destinations[key] for key in sorted(legal_destinations.keys())],
            "blocked_moves": [blocked_destinations[key] for key in sorted(blocked_destinations.keys())],
        }), 200

    # Forced second knight move
    if knight_bonus_move_state["active"]:
        required_side = knight_bonus_move_state["side"]
        required_square_name = knight_bonus_move_state["knight_square"]

        if side != required_side:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

        if chess.square_name(from_square) != required_square_name:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

        legal_destinations = {}

        for move in board.legal_moves:
            if (
                move.from_square == from_square
                and piece.piece_type == chess.KNIGHT
                and is_safe_second_knight_move(board, move)
            ):
                to_square_name = chess.square_name(move.to_square)
                is_capture = board.piece_at(move.to_square) is not None

                legal_destinations[to_square_name] = {
                    "square": to_square_name,
                    "is_capture": is_capture,
                }

        if len(legal_destinations) == 0:
            clear_knight_bonus_move_state()
            board.turn = not board.turn

            return jsonify({
                "status": "ok",
                "from": square_name,
                "moves": [],
                "blocked_moves": [],
                "message": "No available knight moves, turn skipped"
            }), 200

        return jsonify({
            "status": "ok",
            "from": square_name,
            "moves": [legal_destinations[key] for key in sorted(legal_destinations.keys())],
            "blocked_moves": [],
        }), 200

    # Normal turn restriction
    if piece.color != board.turn:
        return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

    side_augments = active_augments[side]
    legal_destinations = {}
    blocked_destinations = {}

    # Standard legal moves
    for move in board.legal_moves:
        if move.from_square == from_square:
            if is_blocked_by_king_guard(board, move, side, active_augments):
                to_square_name = chess.square_name(move.to_square)
                blocked_destinations[to_square_name] = {
                    "square": to_square_name,
                    "reason": "king_guard",
                }
                continue

            to_square_name = chess.square_name(move.to_square)
            is_capture = board.piece_at(move.to_square) is not None

            legal_destinations[to_square_name] = {
                "square": to_square_name,
                "is_capture": is_capture,
            }

    # Knight augment moves
    if side_augments["knight_long_jump"] and piece.piece_type == chess.KNIGHT:
        from_file, from_rank = square_coords(from_square)

        candidate_offsets = [
            (4, 1), (4, -1), (-4, 1), (-4, -1),
            (1, 4), (1, -4), (-1, 4), (-1, -4),
        ]

        for df, dr in candidate_offsets:
            new_file = from_file + df
            new_rank = from_rank + dr

            if 0 <= new_file < 8 and 0 <= new_rank < 8:
                to_square = chess.square(new_file, new_rank)
                custom_move = chess.Move(from_square, to_square)

                if is_safe_custom_knight_move(board, custom_move):
                    to_square_name = chess.square_name(to_square)

                    if is_blocked_by_king_guard(board, custom_move, side, active_augments):
                        blocked_destinations[to_square_name] = {
                            "square": to_square_name,
                            "reason": "king_guard",
                        }
                        continue

                    is_capture = board.piece_at(to_square) is not None

                    legal_destinations[to_square_name] = {
                        "square": to_square_name,
                        "is_capture": is_capture,
                    }

    # Bishop phase moves
    if side_augments["bishop_phase"] and piece.piece_type == chess.BISHOP:
        for to_square in chess.SQUARES:
            if to_square == from_square:
                continue

            custom_move = chess.Move(from_square, to_square)

            if is_safe_custom_bishop_move(board, custom_move):
                to_square_name = chess.square_name(to_square)

                if is_blocked_by_king_guard(board, custom_move, side, active_augments):
                    blocked_destinations[to_square_name] = {
                        "square": to_square_name,
                        "reason": "king_guard",
                    }
                    continue

                is_capture = board.piece_at(to_square) is not None

                legal_destinations[to_square_name] = {
                    "square": to_square_name,
                    "is_capture": is_capture,
                }

    # King stride moves
    if side_augments["king_stride"] and piece.piece_type == chess.KING:
        from_file, from_rank = square_coords(from_square)

        for df in range(-2, 3):
            for dr in range(-2, 3):
                if df == 0 and dr == 0:
                    continue

                new_file = from_file + df
                new_rank = from_rank + dr

                if not (0 <= new_file < 8 and 0 <= new_rank < 8):
                    continue

                to_square = chess.square(new_file, new_rank)
                to_square_name = chess.square_name(to_square)
                custom_move = chess.Move(from_square, to_square)

                destination_piece = board.piece_at(to_square)

                if destination_piece is not None:
                    if destination_piece.color != piece.color:
                        blocked_destinations[to_square_name] = {
                            "square": to_square_name,
                            "reason": "king_stride_no_capture",
                        }
                    continue

                if is_blocked_by_king_guard(board, custom_move, side, active_augments):
                    blocked_destinations[to_square_name] = {
                        "square": to_square_name,
                        "reason": "king_guard",
                    }
                    continue

                if not is_safe_king_destination(board, custom_move):
                    blocked_destinations[to_square_name] = {
                        "square": to_square_name,
                        "reason": "king_in_check",
                    }
                    continue

                legal_destinations[to_square_name] = {
                    "square": to_square_name,
                    "is_capture": False,
                }

    return jsonify({
        "status": "ok",
        "from": square_name,
        "moves": [legal_destinations[key] for key in sorted(legal_destinations.keys())],
        "blocked_moves": [blocked_destinations[key] for key in sorted(blocked_destinations.keys())],
    }), 200


@app.route("/reset", methods=["POST"])
def reset():
    board.reset()
    clear_bishop_double_move_state()
    clear_knight_bonus_move_state()
    reset_turn_count()
    return jsonify({"fen": board.fen(), "difficulty": game_difficulty})


@app.route("/augments", methods=["GET"])
def get_augments():
    return jsonify({
        "status": "ok",
        "active_augments": active_augments
    })


@app.route("/augments", methods=["POST"])
def toggle_augment():
    data = request.get_json()

    side = data.get("side")
    augment_name = data.get("augment")

    if side not in active_augments:
        return jsonify({"status": "error", "message": "Unknown side"}), 400

    if augment_name not in active_augments[side]:
        return jsonify({"status": "error", "message": "Unknown augment"}), 400

    active_augments[side][augment_name] = not active_augments[side][augment_name]

    return jsonify({
        "status": "ok",
        "active_augments": active_augments
    })


if __name__ == "__main__":
    app.run(debug=True)