import chess

board = chess.Board()

# List of active augments
active_augments = {
    "white": {
        "knight_long_jump": False,
        "knight_second_move_after_capture": False,
        "bishop_phase": False,
        "bishop_double_move": False,
        "king_guard": False,
        "king_stride": False,
        "random_mutation": False,
    },
    "black": {
        "knight_long_jump": False,
        "knight_second_move_after_capture": False,
        "bishop_phase": False,
        "bishop_double_move": False,
        "king_guard": False,
        "king_stride": False,
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

def clear_bishop_double_move_state():
    bishop_double_move_state["active"] = False
    bishop_double_move_state["side"] = None
    bishop_double_move_state["bishop_square"] = None

def clear_knight_bonus_move_state():
    knight_bonus_move_state["active"] = False
    knight_bonus_move_state["side"] = None
    knight_bonus_move_state["knight_square"] = None