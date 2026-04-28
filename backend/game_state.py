from flask import jsonify
import chess

board = chess.Board()
turn_count = 0
move_history: list[dict] = []

def increment_turn_count():
    global turn_count
    turn_count += 1

def reset_turn_count():
    global turn_count
    turn_count = 0

def get_turn_count():
    return turn_count

def record_move(move: chess.Move, side: str):
    """Call BEFORE pushing so SAN is generated from current board state."""
    san = board.san(move)
    move_history.append({
        "move_uci": move.uci(),
        "san": san,
        "side": side,
        "turn": turn_count + 1,
    })

def reset_move_history():
    global move_history
    move_history = []

def get_move_history():
    return move_history

# ---------------------------------------------------------------------------
# Augment toggles
# ---------------------------------------------------------------------------

active_augments = {
    "white": {
        # Pawn
        "pawn_two_hits":          False,  # pawn needs 2 captures to be removed
        "pawn_explosion":         False,  # capturing a pawn removes adjacent enemies
        "pawn_double_push":       False,  # pawn can always move 2 squares
        # Knight
        "knight_long_jump":                    False,
        "knight_second_move_after_capture":    False,
        # Bishop
        "bishop_phase":        False,
        "bishop_double_move":  False,
        # Rook
        "rook_triple_move_bonus":              False,
        "rook_pawn_shield":                    False,  # pawns can't capture rook
        # Queen
        "queen_teleport":      False,  # once per game teleport
        "queen_pawn_shield":   False,  # pawns can't capture queen
        # King
        "king_guard":   False,
        "king_stride":  False,
    },
    "black": {
        "pawn_two_hits":          False,
        "pawn_explosion":         False,
        "pawn_double_push":       False,
        "knight_long_jump":                    False,
        "knight_second_move_after_capture":    False,
        "bishop_phase":        False,
        "bishop_double_move":  False,
        "rook_triple_move_bonus":              False,
        "rook_pawn_shield":                    False,
        "queen_teleport":      False,
        "queen_pawn_shield":   False,
        "king_guard":   False,
        "king_stride":  False,
    },
}

# ---------------------------------------------------------------------------
# Bonus-move state trackers
# ---------------------------------------------------------------------------

bishop_double_move_state = {"active": False, "side": None, "bishop_square": None}
knight_bonus_move_state  = {"active": False, "side": None, "knight_square": None}
rook_bonus_move_state    = {"active": False, "side": None, "rook_square": None}

# Pawn shield — which sides currently have the shield active
pawn_protection_state = {"active": False, "side": None}

# Damaged pawns: maps square index -> side ("white"/"black")
# A pawn on this set has taken one hit and will survive the next capture attempt.
damaged_pawns: dict[int, str] = {}

# Queen teleport used flags
queen_teleport_used = {"white": False, "black": False}

# ---------------------------------------------------------------------------
# State helpers
# ---------------------------------------------------------------------------

def clear_bishop_double_move_state():
    bishop_double_move_state.update({"active": False, "side": None, "bishop_square": None})

def clear_knight_bonus_move_state():
    knight_bonus_move_state.update({"active": False, "side": None, "knight_square": None})

def clear_rook_bonus_move_state():
    rook_bonus_move_state.update({"active": False, "side": None, "rook_square": None})

def activate_pawn_protection(side: str):
    pawn_protection_state.update({"active": True, "side": side})

def clear_pawn_protection(side: str):
    pawn_protection_state.update({"active": False, "side": None})

def mark_pawn_damaged(square: int, side: str):
    damaged_pawns[square] = side

def clear_damaged_pawn(square: int):
    damaged_pawns.pop(square, None)

def is_pawn_damaged(square: int) -> bool:
    return square in damaged_pawns

def reset_queen_teleport():
    queen_teleport_used["white"] = False
    queen_teleport_used["black"] = False

def use_queen_teleport(side: str):
    queen_teleport_used[side] = True

def has_queen_teleport(side: str) -> bool:
    return not queen_teleport_used[side]

def full_reset():
    """Reset all game state for a new game."""
    global damaged_pawns
    board.reset()
    reset_turn_count()
    reset_move_history()
    clear_bishop_double_move_state()
    clear_knight_bonus_move_state()
    clear_rook_bonus_move_state()
    clear_pawn_protection("white")
    clear_pawn_protection("black")
    damaged_pawns = {}
    reset_queen_teleport()

# ---------------------------------------------------------------------------
# Response builder
# ---------------------------------------------------------------------------

def build_game_status_response(message: str):
    is_checkmate = board.is_checkmate()
    is_stalemate = board.is_stalemate()
    winner = None
    final_message = message

    if is_checkmate:
        winner = "black" if board.turn else "white"
        final_message = f"Checkmate - {winner.capitalize()} wins"
    elif is_stalemate:
        final_message = "Stalemate - Draw"

    return jsonify({
        "status": "ok",
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "is_checkmate": is_checkmate,
        "is_stalemate": is_stalemate,
        "winner": winner,
        "message": final_message,
        "turn_count": get_turn_count(),
        "move_history": get_move_history(),
        "damaged_pawns": [sq for sq in damaged_pawns.keys()],
        "queen_teleport_used": queen_teleport_used,
    })