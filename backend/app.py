from flask import Flask, jsonify, request
from flask_cors import CORS

from clerk_auth import extract_bearer_token, verify_clerk_token
from database import DbConnection
from messages_service import load_messages, save_messages

from game_state import (
    board, active_augments,
    bishop_double_move_state, knight_bonus_move_state,
    rook_bonus_move_state, pawn_protection_state,
    clear_bishop_double_move_state, clear_knight_bonus_move_state,
    build_game_status_response, clear_rook_bonus_move_state,
    activate_pawn_protection, clear_pawn_protection,
    turn_count, increment_turn_count, reset_turn_count, get_turn_count,
    record_move, reset_move_history, get_move_history,
    damaged_pawns, mark_pawn_damaged, clear_damaged_pawn, is_pawn_damaged,
    queen_teleport_used, use_queen_teleport, has_queen_teleport,
    full_reset,
)

from augments import (
    square_coords, get_piece_side, get_adjacent_squares,
    is_extended_knight_move, is_safe_custom_knight_move, is_safe_second_knight_move,
    is_safe_custom_bishop_move, is_safe_second_bishop_move,
    is_blocked_by_king_guard, is_safe_custom_king_stride, is_safe_king_destination,
    trigger_rook_move, is_safe_second_rook_move,
    is_pawn_shield_blocked,
    is_valid_queen_teleport,
    is_pawn_double_push_move,
)

from agent import get_ai_move
from init_db import init_db

import chess
from datetime import datetime

app = Flask(__name__)
CORS(app)

init_db()

db = DbConnection()
game_difficulty = "medium"
_current_clerk_user_id: str | None = None
_game_already_saved: bool = False


# ---------------------------------------------------------------------------
# Elo helpers
# ---------------------------------------------------------------------------

ELO_K = 32
AI_RATING = {"easy": 800, "medium": 1200, "hard": 1800}

def _expected_score(player_rating: int, opponent_rating: int) -> float:
    return 1 / (1 + 10 ** ((opponent_rating - player_rating) / 400))

def _calc_rating_change(player_rating: int, result: str, difficulty: str) -> int:
    ai_r  = AI_RATING.get(difficulty, 1200)
    score = 1.0 if result == "win" else (0.5 if result == "draw" else 0.0)
    new_r = round(player_rating + ELO_K * (score - _expected_score(player_rating, ai_r)))
    return new_r - player_rating

def _save_game_result(result: str) -> None:
    global _game_already_saved
    if not _current_clerk_user_id or _game_already_saved:
        return
    try:
        profile = db.get_profile_by_clerk_user_id(_current_clerk_user_id)
        if not profile:
            return
        rating_change = _calc_rating_change(profile["rating"], result, game_difficulty)
        db.record_game_result(
            clerk_user_id=_current_clerk_user_id,
            opponent_name=f"AI ({game_difficulty})",
            opponent_type="ai",
            result=result,
            rating_change=rating_change,
            difficulty=game_difficulty,
        )
        _game_already_saved = True
    except Exception as e:
        print(f"Error saving game result: {e}")

def _check_and_save_if_game_over() -> None:
    if board.is_checkmate():
        result = "win" if not board.turn else "loss"
        _save_game_result(result)
    elif board.is_stalemate() or board.is_insufficient_material() or board.is_seventyfive_moves():
        _save_game_result("draw")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def _try_get_clerk_user_id() -> str | None:
    global _current_clerk_user_id
    try:
        token  = extract_bearer_token(request)
        claims = verify_clerk_token(token)
        _current_clerk_user_id = claims.get("sub")
    except Exception:
        pass
    return _current_clerk_user_id


# ---------------------------------------------------------------------------
# Pawn shield helper (checks both rook + queen shields for moving side)
# ---------------------------------------------------------------------------

def _is_pawn_capture_blocked(chess_move: chess.Move) -> bool:
    """
    Check if a move is a pawn capturing a shielded rook or queen.
    Looks up the DEFENDER's augments (the side that owns the target piece).
    """
    attacker = board.piece_at(chess_move.from_square)
    target   = board.piece_at(chess_move.to_square)
    if not attacker or not target or attacker.piece_type != chess.PAWN:
        return False
    defender_side = get_piece_side(target)
    defender_augments = active_augments[defender_side]
    return is_pawn_shield_blocked(board, chess_move, defender_augments)


# ---------------------------------------------------------------------------
# Pawn explosion helper
# ---------------------------------------------------------------------------

def _apply_pawn_explosion(captured_square: int, capturing_side: str) -> list[int]:
    """
    Remove all enemy pieces in the 8 squares around the captured pawn.
    Returns list of squares that were exploded.
    """
    enemy_color  = chess.WHITE if capturing_side == "black" else chess.BLACK
    exploded = []
    for sq in get_adjacent_squares(captured_square):
        piece = board.piece_at(sq)
        if piece and piece.color == enemy_color and piece.piece_type != chess.KING:
            board.remove_piece_at(sq)
            clear_damaged_pawn(sq)
            exploded.append(sq)
    return exploded


# ---------------------------------------------------------------------------
# AI helper
# ---------------------------------------------------------------------------

def _trigger_ai_move():
    if board.turn != chess.BLACK or board.is_game_over():
        return
    try:
        ai_uci = get_ai_move(board, game_difficulty)
        if not ai_uci:
            return
        ai_move = chess.Move.from_uci(ai_uci)
        if ai_move in board.legal_moves:
            record_move(ai_move, "black")
            board.push(ai_move)
            increment_turn_count()
    except Exception as e:
        print(f"AI move error: {e}")

def build_game_status_response_with_ai(message: str):
    _trigger_ai_move()
    _check_and_save_if_game_over()
    return build_game_status_response(message)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


# ---------------------------------------------------------------------------
# Difficulty
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Profile / Leaderboard / Games / Stats
# ---------------------------------------------------------------------------

@app.route("/profile", methods=["GET"])
def get_profile():
    try:
        token  = extract_bearer_token(request)
        claims = verify_clerk_token(token)
        clerk_user_id = claims.get("sub")
        if not clerk_user_id:
            return jsonify({"message": "Missing Clerk user id"}), 401
        profile = db.create_profile_if_missing(
            clerk_user_id=clerk_user_id,
            email=claims.get("email"),
            display_name=claims.get("name") or claims.get("given_name"),
        )
        return jsonify({"profile": profile}), 200
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401

@app.route("/leaderboard", methods=["GET"])
def get_leaderboard():
    try:
        token  = extract_bearer_token(request)
        claims = verify_clerk_token(token)
        clerk_user_id = claims.get("sub")
        profiles = db.get_all_profiles()
        leaderboard = []
        for index, profile in enumerate(profiles, start=1):
            games  = profile.get("games_played", 0)
            wins   = profile.get("wins", 0)
            losses = profile.get("losses", 0)
            leaderboard.append({
                "rank": index,
                "name": profile.get("display_name") or "Player",
                "rating": profile.get("rating", 1200),
                "wins": wins, "losses": losses, "games_played": games,
                "win_rate": round(wins / games * 100) if games > 0 else 0,
                "is_current_user": profile.get("clerk_user_id") == clerk_user_id,
                "is_ai": False,
                "clerk_user_id": profile.get("clerk_user_id"),
            })
        return jsonify({"leaderboard": leaderboard}), 200
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401

@app.route("/games", methods=["GET"])
def get_games():
    try:
        token  = extract_bearer_token(request)
        claims = verify_clerk_token(token)
        games  = db.get_recent_games(claims.get("sub"))
        return jsonify({"games": games}), 200
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401

@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        token  = extract_bearer_token(request)
        claims = verify_clerk_token(token)
        clerk_user_id = claims.get("sub")
        if not clerk_user_id:
            return jsonify({"message": "Missing Clerk user id"}), 401
        profile = db.get_profile_by_clerk_user_id(clerk_user_id)
        if not profile:
            return jsonify({"message": "Profile not found"}), 404
        breakdown    = db.get_stats_by_difficulty(clerk_user_id)
        games_played = profile.get("games_played", 0)
        wins         = profile.get("wins", 0)
        return jsonify({"stats": {
            "rating": profile.get("rating", 1200),
            "wins": wins, "losses": profile.get("losses", 0),
            "games_played": games_played,
            "win_rate": round(wins / games_played * 100) if games_played > 0 else 0,
            "by_difficulty": breakdown,
        }}), 200
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@app.route("/messages/<difficulty>", methods=["GET"])
def get_messages(difficulty):
    try:
        token = extract_bearer_token(request)
        verify_clerk_token(token)
        return jsonify({"messages": load_messages(difficulty)}), 200
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401

@app.route("/messages/<difficulty>", methods=["POST"])
def post_message(difficulty):
    try:
        token  = extract_bearer_token(request)
        claims = verify_clerk_token(token)
        data   = request.get_json()
        if not data:
            return jsonify({"message": "Invalid JSON body"}), 400
        message_text = (data.get("message") or "").strip()
        if not message_text:
            return jsonify({"message": "Message cannot be empty"}), 400
        if len(message_text) > 300:
            return jsonify({"message": "Message too long"}), 400
        profile = db.create_profile_if_missing(
            clerk_user_id=claims.get("sub"),
            email=claims.get("email"),
            display_name=claims.get("name") or claims.get("given_name"),
        )
        messages = load_messages(difficulty)
        new_msg  = {
            "id": datetime.now().strftime("%Y%m%d%H%M%S%f"),
            "username": profile.get("display_name") or "Player",
            "clerk_user_id": claims.get("sub"),
            "message": message_text,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        messages.append(new_msg)
        save_messages(difficulty, messages)
        return jsonify({"message": "Message posted successfully", "posted_message": new_msg, "messages": messages}), 201
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except Exception as exc:
        return jsonify({"message": str(exc)}), 401


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

@app.route("/board", methods=["GET"])
def get_board():
    _try_get_clerk_user_id()
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
        "move_history": get_move_history(),
        "damaged_pawns": list(damaged_pawns.keys()),
        "queen_teleport_used": queen_teleport_used,
    })


# ---------------------------------------------------------------------------
# Move
# ---------------------------------------------------------------------------

@app.route("/move", methods=["POST"])
def make_move():
    _try_get_clerk_user_id()
    data = request.get_json()
    move = data.get("move")

    try:
        chess_move = chess.Move.from_uci(move)
        piece = board.piece_at(chess_move.from_square)

        if not piece:
            return jsonify({"status": "illegal", "message": "No piece selected"})

        side          = get_piece_side(piece)
        side_augments = active_augments[side]
        enemy_side    = "black" if side == "white" else "white"

        if is_blocked_by_king_guard(board, chess_move, side, active_augments):
            return jsonify({"status": "illegal", "message": "That square is protected by King Guard"})

        # ----------------------------------------------------------------
        # Forced bonus moves (bishop / knight / rook second move)
        # ----------------------------------------------------------------

        if bishop_double_move_state["active"]:
            if side != bishop_double_move_state["side"]:
                return jsonify({"status": "illegal", "message": "Must complete bishop second move"})
            if chess.square_name(chess_move.from_square) != bishop_double_move_state["bishop_square"]:
                return jsonify({"status": "illegal", "message": "Must move the same bishop again"})
            if piece.piece_type != chess.BISHOP:
                return jsonify({"status": "illegal", "message": "Second move must be made by that bishop"})
            if not is_safe_second_bishop_move(board, chess_move):
                return jsonify({"status": "illegal", "message": "Second bishop move cannot capture"})
            record_move(chess_move, side)
            board.push(chess_move)
            clear_bishop_double_move_state()
            return build_game_status_response_with_ai("Second bishop move completed")

        if knight_bonus_move_state["active"]:
            if side != knight_bonus_move_state["side"]:
                return jsonify({"status": "illegal", "message": "Must complete knight bonus move"})
            if chess.square_name(chess_move.from_square) != knight_bonus_move_state["knight_square"]:
                return jsonify({"status": "illegal", "message": "Must move the same knight again"})
            if piece.piece_type != chess.KNIGHT:
                return jsonify({"status": "illegal", "message": "Second move must be made by that knight"})
            if not is_safe_second_knight_move(board, chess_move):
                return jsonify({"status": "illegal", "message": "Illegal second knight move"})
            record_move(chess_move, side)
            board.push(chess_move)
            clear_knight_bonus_move_state()
            return build_game_status_response_with_ai("Second knight move completed")

        if rook_bonus_move_state["active"]:
            if side != rook_bonus_move_state["side"]:
                return jsonify({"status": "illegal", "message": "Must complete rook bonus move"})
            if chess.square_name(chess_move.from_square) != rook_bonus_move_state["rook_square"]:
                return jsonify({"status": "illegal", "message": "Must move the same rook again"})
            if piece.piece_type != chess.ROOK:
                return jsonify({"status": "illegal", "message": "Second move must be made by that rook"})
            if not is_safe_second_rook_move(board, chess_move):
                return jsonify({"status": "illegal", "message": "Illegal second rook move"})
            record_move(chess_move, side)
            board.push(chess_move)
            clear_rook_bonus_move_state()
            return build_game_status_response_with_ai("Second rook move completed")

        # ----------------------------------------------------------------
        # Queen teleport (custom move — before standard legal check)
        # ----------------------------------------------------------------

        if (
            side_augments["queen_teleport"]
            and has_queen_teleport(side)
            and piece.piece_type == chess.QUEEN
            and chess_move not in board.legal_moves
            and is_valid_queen_teleport(board, chess_move)
        ):
            record_move(chess_move, side)
            board.remove_piece_at(chess_move.from_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn
            increment_turn_count()
            use_queen_teleport(side)
            return build_game_status_response_with_ai("Queen teleported!")

        # ----------------------------------------------------------------
        # Standard legal move
        # ----------------------------------------------------------------

        if chess_move in board.legal_moves:
            moving_piece_type = piece.piece_type
            target_piece      = board.piece_at(chess_move.to_square)
            was_capture       = target_piece is not None

            # Pawn shield check
            if _is_pawn_capture_blocked(chess_move):
                return jsonify({"status": "illegal", "message": "Pawn cannot capture that piece"})

            # ---- Pawn two-hits augment ----
            if (
                was_capture
                and moving_piece_type == chess.PAWN
                and target_piece.piece_type == chess.PAWN
                and active_augments[enemy_side]["pawn_two_hits"]
                and is_pawn_damaged(chess_move.to_square)
            ):
                # Second hit — remove the damaged pawn normally (fall through)
                clear_damaged_pawn(chess_move.to_square)

            elif (
                was_capture
                and moving_piece_type == chess.PAWN
                and target_piece.piece_type == chess.PAWN
                and active_augments[enemy_side]["pawn_two_hits"]
                and not is_pawn_damaged(chess_move.to_square)
            ):
                # First hit — pawn survives, mark as damaged, don't capture
                mark_pawn_damaged(chess_move.to_square, enemy_side)
                # Move the attacking pawn back — it's an illegal "soft" capture
                # Instead: just don't execute the capture; end the turn
                board.turn = not board.turn
                increment_turn_count()
                return build_game_status_response_with_ai(
                    "Pawn survived the first hit! It is now damaged."
                )

            record_move(chess_move, side)
            board.push(chess_move)
            increment_turn_count()

            # Update damaged pawn tracking: if the capturing pawn moved away
            # from a damaged square, that square no longer holds a damaged pawn
            clear_damaged_pawn(chess_move.from_square)

            # ---- Pawn explosion ----
            if (
                side_augments["pawn_explosion"]
                and moving_piece_type == chess.PAWN
                and was_capture
                and target_piece.piece_type == chess.PAWN
            ):
                _apply_pawn_explosion(chess_move.to_square, side)

            # ---- Rook triple move bonus ----
            if side_augments["rook_triple_move_bonus"] and moving_piece_type == chess.ROOK and trigger_rook_move(board, chess_move, moving_piece_type):
                board.turn = not board.turn
                clear_bishop_double_move_state()
                clear_knight_bonus_move_state()
                rook_bonus_move_state.update({"active": True, "side": side, "rook_square": chess.square_name(chess_move.to_square)})
                return build_game_status_response("Rook may move again")

            # ---- Bishop double move ----
            if side_augments["bishop_double_move"] and moving_piece_type == chess.BISHOP and not was_capture:
                board.turn = not board.turn
                clear_knight_bonus_move_state()
                bishop_double_move_state.update({"active": True, "side": side, "bishop_square": chess.square_name(chess_move.to_square)})
                return build_game_status_response("Bishop may move again")

            if side_augments["bishop_double_move"] and moving_piece_type == chess.BISHOP and was_capture:
                clear_bishop_double_move_state()
                clear_knight_bonus_move_state()
                return build_game_status_response_with_ai("Bishop capture ends turn")

            # ---- Knight second move after capture ----
            if side_augments["knight_second_move_after_capture"] and moving_piece_type == chess.KNIGHT and was_capture:
                board.turn = not board.turn
                clear_bishop_double_move_state()
                knight_bonus_move_state.update({"active": True, "side": side, "knight_square": chess.square_name(chess_move.to_square)})
                return build_game_status_response("Knight may move again")

            clear_bishop_double_move_state()
            clear_knight_bonus_move_state()
            clear_rook_bonus_move_state()
            return build_game_status_response_with_ai("Move completed")

        # ----------------------------------------------------------------
        # Augment custom moves
        # ----------------------------------------------------------------

        # Knight long jump
        if (
            side_augments["knight_long_jump"]
            and piece.piece_type == chess.KNIGHT
            and is_extended_knight_move(chess_move.from_square, chess_move.to_square)
            and is_safe_custom_knight_move(board, chess_move)
        ):
            record_move(chess_move, side)
            board.remove_piece_at(chess_move.from_square)
            board.remove_piece_at(chess_move.to_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn
            increment_turn_count()
            return build_game_status_response_with_ai("Knight long jump!")

        # Bishop phase
        if (
            side_augments["bishop_phase"]
            and piece.piece_type == chess.BISHOP
            and is_safe_custom_bishop_move(board, chess_move)
        ):
            record_move(chess_move, side)
            board.remove_piece_at(chess_move.from_square)
            board.remove_piece_at(chess_move.to_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn
            increment_turn_count()
            return build_game_status_response_with_ai("Bishop phased through!")

        # King stride
        if (
            side_augments["king_stride"]
            and piece.piece_type == chess.KING
            and is_safe_custom_king_stride(board, chess_move)
        ):
            if is_blocked_by_king_guard(board, chess_move, side, active_augments):
                return jsonify({"status": "illegal", "message": "That square is protected by King Guard"})
            record_move(chess_move, side)
            board.remove_piece_at(chess_move.from_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn
            increment_turn_count()
            clear_bishop_double_move_state()
            clear_knight_bonus_move_state()
            return build_game_status_response_with_ai("King stride!")

        # Pawn double push (any rank)
        if (
            side_augments["pawn_double_push"]
            and piece.piece_type == chess.PAWN
            and is_pawn_double_push_move(board, chess_move)
        ):
            record_move(chess_move, side)
            board.remove_piece_at(chess_move.from_square)
            board.set_piece_at(chess_move.to_square, piece)
            board.turn = not board.turn
            increment_turn_count()
            return build_game_status_response_with_ai("Pawn double push!")

        return jsonify({"status": "illegal", "message": "Illegal move"})

    except ValueError:
        return jsonify({"status": "error", "message": "Invalid move format"})
    except Exception as e:
        print("MOVE ERROR:", e)
        return jsonify({"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Forfeit
# ---------------------------------------------------------------------------

@app.route("/forfeit", methods=["POST"])
def forfeit():
    _try_get_clerk_user_id()
    if not board.is_game_over():
        _save_game_result("loss")
    return jsonify({
        "status": "ok",
        "message": "You forfeited.",
        "fen": board.fen(),
        "move_history": get_move_history(),
    })


# ---------------------------------------------------------------------------
# Legal moves
# ---------------------------------------------------------------------------

@app.route("/legal-moves/<square_name>", methods=["GET"])
def get_legal_moves(square_name):
    if board.is_checkmate():
        winner = "black" if board.turn else "white"
        return jsonify({"status": "ok", "moves": [], "blocked_moves": [],
                        "message": f"Checkmate - {winner.capitalize()} wins",
                        "is_checkmate": True, "is_stalemate": False, "winner": winner}), 200

    if board.is_stalemate():
        return jsonify({"status": "ok", "moves": [], "blocked_moves": [],
                        "message": "Stalemate - Draw",
                        "is_checkmate": False, "is_stalemate": True, "winner": None}), 200

    try:
        from_square = chess.parse_square(square_name)
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid square", "moves": [], "blocked_moves": []}), 400

    piece = board.piece_at(from_square)
    if not piece:
        return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

    side          = get_piece_side(piece)
    side_augments = active_augments[side]
    enemy_side    = "black" if side == "white" else "white"

    # ---- Forced bonus move states ----

    if bishop_double_move_state["active"]:
        if side != bishop_double_move_state["side"] or chess.square_name(from_square) != bishop_double_move_state["bishop_square"]:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200
        legal_destinations, blocked_destinations = {}, {}
        for move in board.legal_moves:
            if move.from_square != from_square or piece.piece_type != chess.BISHOP:
                continue
            to_name = chess.square_name(move.to_square)
            if board.piece_at(move.to_square) is not None:
                blocked_destinations[to_name] = {"square": to_name, "reason": "second_bishop_move_no_capture"}
                continue
            if is_safe_second_bishop_move(board, move):
                legal_destinations[to_name] = {"square": to_name, "is_capture": False}
        if not legal_destinations:
            clear_bishop_double_move_state()
            board.turn = not board.turn
            return jsonify({"status": "ok", "from": square_name, "moves": [], "blocked_moves": [],
                            "message": "No available bishop moves, turn skipped"}), 200
        return jsonify({"status": "ok", "from": square_name,
                        "moves": [legal_destinations[k] for k in sorted(legal_destinations)],
                        "blocked_moves": [blocked_destinations[k] for k in sorted(blocked_destinations)]}), 200

    if knight_bonus_move_state["active"]:
        if side != knight_bonus_move_state["side"] or chess.square_name(from_square) != knight_bonus_move_state["knight_square"]:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200
        legal_destinations = {}
        for move in board.legal_moves:
            if move.from_square == from_square and piece.piece_type == chess.KNIGHT and is_safe_second_knight_move(board, move):
                to_name = chess.square_name(move.to_square)
                legal_destinations[to_name] = {"square": to_name, "is_capture": board.piece_at(move.to_square) is not None}
        if not legal_destinations:
            clear_knight_bonus_move_state()
            board.turn = not board.turn
            return jsonify({"status": "ok", "from": square_name, "moves": [], "blocked_moves": [],
                            "message": "No available knight moves, turn skipped"}), 200
        return jsonify({"status": "ok", "from": square_name,
                        "moves": [legal_destinations[k] for k in sorted(legal_destinations)],
                        "blocked_moves": []}), 200

    if rook_bonus_move_state["active"]:
        if side != rook_bonus_move_state["side"] or chess.square_name(from_square) != rook_bonus_move_state["rook_square"]:
            return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200
        legal_destinations = {}
        for move in board.legal_moves:
            if move.from_square == from_square and piece.piece_type == chess.ROOK and is_safe_second_rook_move(board, move):
                to_name = chess.square_name(move.to_square)
                legal_destinations[to_name] = {"square": to_name, "is_capture": board.piece_at(move.to_square) is not None}
        if not legal_destinations:
            clear_rook_bonus_move_state()
            board.turn = not board.turn
            return jsonify({"status": "ok", "from": square_name, "moves": [], "blocked_moves": [],
                            "message": "No available rook moves, turn skipped"}), 200
        return jsonify({"status": "ok", "from": square_name,
                        "moves": [legal_destinations[k] for k in sorted(legal_destinations)],
                        "blocked_moves": []}), 200

    if piece.color != board.turn:
        return jsonify({"status": "ok", "moves": [], "blocked_moves": []}), 200

    legal_destinations, blocked_destinations = {}, {}

    # Standard legal moves
    for move in board.legal_moves:
        if move.from_square != from_square:
            continue
        to_name = chess.square_name(move.to_square)
        if is_blocked_by_king_guard(board, move, side, active_augments):
            blocked_destinations[to_name] = {"square": to_name, "reason": "king_guard"}
            continue
        if _is_pawn_capture_blocked(move):
            blocked_destinations[to_name] = {"square": to_name, "reason": "pawn_shield"}
            continue
        legal_destinations[to_name] = {"square": to_name, "is_capture": board.piece_at(move.to_square) is not None}

    # Knight long jump
    if side_augments["knight_long_jump"] and piece.piece_type == chess.KNIGHT:
        from_file, from_rank = square_coords(from_square)
        for df, dr in [(4,1),(4,-1),(-4,1),(-4,-1),(1,4),(1,-4),(-1,4),(-1,-4)]:
            nf, nr = from_file + df, from_rank + dr
            if not (0 <= nf < 8 and 0 <= nr < 8):
                continue
            to_sq   = chess.square(nf, nr)
            to_name = chess.square_name(to_sq)
            custom_move = chess.Move(from_square, to_sq)
            if not is_safe_custom_knight_move(board, custom_move):
                continue
            if is_blocked_by_king_guard(board, custom_move, side, active_augments):
                blocked_destinations[to_name] = {"square": to_name, "reason": "king_guard"}
                continue
            legal_destinations[to_name] = {"square": to_name, "is_capture": board.piece_at(to_sq) is not None}

    # Bishop phase
    if side_augments["bishop_phase"] and piece.piece_type == chess.BISHOP:
        for to_sq in chess.SQUARES:
            if to_sq == from_square:
                continue
            custom_move = chess.Move(from_square, to_sq)
            if not is_safe_custom_bishop_move(board, custom_move):
                continue
            to_name = chess.square_name(to_sq)
            if is_blocked_by_king_guard(board, custom_move, side, active_augments):
                blocked_destinations[to_name] = {"square": to_name, "reason": "king_guard"}
                continue
            legal_destinations[to_name] = {"square": to_name, "is_capture": board.piece_at(to_sq) is not None}

    # King stride
    if side_augments["king_stride"] and piece.piece_type == chess.KING:
        from_file, from_rank = square_coords(from_square)
        for df in range(-2, 3):
            for dr in range(-2, 3):
                if df == 0 and dr == 0:
                    continue
                nf, nr = from_file + df, from_rank + dr
                if not (0 <= nf < 8 and 0 <= nr < 8):
                    continue
                to_sq   = chess.square(nf, nr)
                to_name = chess.square_name(to_sq)
                custom_move = chess.Move(from_square, to_sq)
                dest_piece  = board.piece_at(to_sq)
                if dest_piece is not None:
                    if dest_piece.color != piece.color:
                        blocked_destinations[to_name] = {"square": to_name, "reason": "king_stride_no_capture"}
                    continue
                if is_blocked_by_king_guard(board, custom_move, side, active_augments):
                    blocked_destinations[to_name] = {"square": to_name, "reason": "king_guard"}
                    continue
                if not is_safe_king_destination(board, custom_move):
                    blocked_destinations[to_name] = {"square": to_name, "reason": "king_in_check"}
                    continue
                legal_destinations[to_name] = {"square": to_name, "is_capture": False}

    # Pawn double push
    if side_augments["pawn_double_push"] and piece.piece_type == chess.PAWN:
        from_file, from_rank = square_coords(from_square)
        direction = 1 if piece.color == chess.WHITE else -1
        to_sq = chess.square(from_file, from_rank + 2 * direction)
        if 0 <= chess.square_rank(to_sq) < 8:
            custom_move = chess.Move(from_square, to_sq)
            to_name = chess.square_name(to_sq)
            if is_pawn_double_push_move(board, custom_move) and to_name not in legal_destinations:
                legal_destinations[to_name] = {"square": to_name, "is_capture": False}

    # Queen teleport
    if side_augments["queen_teleport"] and has_queen_teleport(side) and piece.piece_type == chess.QUEEN:
        for to_sq in chess.SQUARES:
            if to_sq == from_square:
                continue
            if board.piece_at(to_sq) is not None:
                continue
            custom_move = chess.Move(from_square, to_sq)
            to_name = chess.square_name(to_sq)
            if is_valid_queen_teleport(board, custom_move) and to_name not in legal_destinations:
                legal_destinations[to_name] = {"square": to_name, "is_capture": False, "is_teleport": True}

    return jsonify({
        "status": "ok",
        "from": square_name,
        "moves": [legal_destinations[k] for k in sorted(legal_destinations)],
        "blocked_moves": [blocked_destinations[k] for k in sorted(blocked_destinations)],
    }), 200


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

@app.route("/reset", methods=["POST"])
def reset():
    global _game_already_saved
    full_reset()
    _game_already_saved = False
    return jsonify({"fen": board.fen(), "difficulty": game_difficulty})


# ---------------------------------------------------------------------------
# Augments
# ---------------------------------------------------------------------------

@app.route("/augments", methods=["GET"])
def get_augments():
    return jsonify({"status": "ok", "active_augments": active_augments})

@app.route("/augments", methods=["POST"])
def toggle_augment():
    data = request.get_json()
    side        = data.get("side")
    augment_name = data.get("augment")
    if side not in active_augments:
        return jsonify({"status": "error", "message": "Unknown side"}), 400
    if augment_name not in active_augments[side]:
        return jsonify({"status": "error", "message": "Unknown augment"}), 400
    active_augments[side][augment_name] = not active_augments[side][augment_name]
    return jsonify({"status": "ok", "active_augments": active_augments})


if __name__ == "__main__":
    app.run(debug=True)