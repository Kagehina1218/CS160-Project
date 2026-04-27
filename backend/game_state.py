from flask import jsonify
import chess

board = chess.Board()

turn_count = 0

def increment_turn_count():
    global turn_count
    turn_count += 1

def reset_turn_count():
    global turn_count
    turn_count = 0

def get_turn_count():
    return turn_count

# List of active augments
active_augments = {
    "white": {
        "knight_long_jump": False,
        "knight_second_move_after_capture": False,
        "bishop_phase": False,
        "bishop_double_move": False,
        "king_guard": False,
        "king_stride": False,
        "rook_triple_move_bonus": False,
        "rook_queen_pawn_capturing_disabled": False,
        "random_mutation": False,
    },
    "black": {
        "knight_long_jump": False,
        "knight_second_move_after_capture": False,
        "bishop_phase": False,
        "bishop_double_move": False,
        "king_guard": False,
        "king_stride": False,
        "rook_triple_move_bonus": False,
        "rook_queen_pawn_capturing_disabled": False,
        "random_mutation": False,
    },
}

# Global state tracker for bishops
bishop_double_move_state = {
    "active": False,
    "side": None,
    "bishop_square": None,
}

# Global state tracker for knights
knight_bonus_move_state = {
    "active": False,
    "side": None,
    "knight_square": None,
}

# Global state tracker for rook
rook_bonus_move_state = {
    "active": False,
    "side": None,
    "rook_square": None,
}

# Global state tracker for rook
pawn_protection_state = {
    "active": False,
    "side": None,
}

def clear_bishop_double_move_state():
    bishop_double_move_state["active"] = False
    bishop_double_move_state["side"] = None
    bishop_double_move_state["bishop_square"] = None

def clear_knight_bonus_move_state():
    knight_bonus_move_state["active"] = False
    knight_bonus_move_state["side"] = None
    knight_bonus_move_state["knight_square"] = None

def clear_rook_bonus_move_state():
    rook_bonus_move_state["active"] = False
    rook_bonus_move_state["side"] = None
    rook_bonus_move_state["rook_square"] = None

def activate_pawn_protection(side: str):
    pawn_protection_state["active"] = True
    pawn_protection_state["side"] = side

def clear_pawn_protection(side: str):
    pawn_protection_state["active"] = False
    pawn_protection_state["side"] = None
    
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
    })