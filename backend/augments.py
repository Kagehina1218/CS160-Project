import chess


def square_coords(square: int):
    return chess.square_file(square), chess.square_rank(square)


def get_piece_side(piece: chess.Piece) -> str:
    return "white" if piece.color == chess.WHITE else "black"


# -------------------------
# Pawn Augment Helpers
# -------------------------

def get_adjacent_squares(square: int) -> list[int]:
    """All 8 surrounding squares (within board bounds)."""
    file, rank = square_coords(square)
    result = []
    for df in [-1, 0, 1]:
        for dr in [-1, 0, 1]:
            if df == 0 and dr == 0:
                continue
            nf, nr = file + df, rank + dr
            if 0 <= nf < 8 and 0 <= nr < 8:
                result.append(chess.square(nf, nr))
    return result


def is_pawn_double_push_move(board: chess.Board, move: chess.Move) -> bool:
    """
    Returns True if this is a valid 2-square pawn push from any rank
    (not just the starting rank), assuming pawn_double_push augment is active.
    The path must be clear and the destination empty.
    """
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.PAWN:
        return False

    from_file, from_rank = square_coords(move.from_square)
    to_file, to_rank = square_coords(move.to_square)

    # Must stay on same file (straight push)
    if from_file != to_file:
        return False

    # Must move exactly 2 ranks in correct direction
    direction = 1 if piece.color == chess.WHITE else -1
    if to_rank - from_rank != 2 * direction:
        return False

    # Destination must be empty
    if board.piece_at(move.to_square) is not None:
        return False

    # Intermediate square must be empty
    mid_square = chess.square(from_file, from_rank + direction)
    if board.piece_at(mid_square) is not None:
        return False

    # Must not leave king in check — simulate
    test_board = board.copy(stack=False)
    test_board.remove_piece_at(move.from_square)
    test_board.set_piece_at(move.to_square, piece)
    return not test_board.is_check()


def is_pawn_blocked_from_capturing(board: chess.Board, move: chess.Move, pawn_protection_state) -> bool:
    """
    Blocks a pawn from capturing a rook or queen belonging to the protected side.
    Used by rook_pawn_shield and queen_pawn_shield.
    """
    attacker = board.piece_at(move.from_square)
    target   = board.piece_at(move.to_square)

    if not attacker or not target:
        return False

    protected_side = pawn_protection_state.get("side")
    if not protected_side:
        return False

    if attacker.piece_type != chess.PAWN:
        return False

    if get_piece_side(target) != protected_side:
        return False

    return target.piece_type in [chess.ROOK, chess.QUEEN]


def is_pawn_shield_blocked(board: chess.Board, move: chess.Move, side_augments: dict) -> bool:
    """
    Combined check: is this pawn capture blocked by rook_pawn_shield or queen_pawn_shield?
    `side_augments` is the augment dict for the DEFENDING side (whose pieces are protected).
    """
    attacker = board.piece_at(move.from_square)
    target   = board.piece_at(move.to_square)

    if not attacker or not target or attacker.piece_type != chess.PAWN:
        return False

    if target.piece_type == chess.ROOK and side_augments.get("rook_pawn_shield"):
        return True
    if target.piece_type == chess.QUEEN and side_augments.get("queen_pawn_shield"):
        return True

    return False

# -------------------------
# Knight Augment Helpers
# -------------------------

def is_extended_knight_move(from_square: int, to_square: int) -> bool:
    from_file, from_rank = square_coords(from_square)
    to_file, to_rank     = square_coords(to_square)
    delta_file = abs(from_file - to_file)
    delta_rank = abs(from_rank - to_rank)
    return sorted([delta_file, delta_rank]) == [1, 4]


def is_safe_custom_knight_move(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.KNIGHT:
        return False
    target = board.piece_at(move.to_square)
    if target and target.color == piece.color:
        return False
    test_board = board.copy(stack=False)
    test_board.remove_piece_at(move.from_square)
    test_board.remove_piece_at(move.to_square)
    test_board.set_piece_at(move.to_square, piece)
    return not test_board.is_check()


def is_safe_second_knight_move(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.KNIGHT:
        return False
    return move in board.legal_moves


# -------------------------
# Bishop Augment Helpers
# -------------------------

def is_diagonal_move(from_square: int, to_square: int) -> bool:
    from_file, from_rank = square_coords(from_square)
    to_file, to_rank     = square_coords(to_square)
    return abs(from_file - to_file) == abs(from_rank - to_rank)


def get_path_squares(from_square: int, to_square: int):
    from_file, from_rank = square_coords(from_square)
    to_file, to_rank     = square_coords(to_square)
    file_step = 1 if to_file > from_file else -1
    rank_step = 1 if to_rank > from_rank else -1
    path = []
    cf, cr = from_file + file_step, from_rank + rank_step
    while cf != to_file and cr != to_rank:
        path.append(chess.square(cf, cr))
        cf += file_step
        cr += rank_step
    return path


def is_bishop_phase_move(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.BISHOP:
        return False
    if not is_diagonal_move(move.from_square, move.to_square):
        return False
    target = board.piece_at(move.to_square)
    if target and target.color == piece.color:
        return False
    path_squares = get_path_squares(move.from_square, move.to_square)
    blocking = sum(1 for sq in path_squares if board.piece_at(sq) is not None)
    return blocking == 1


def is_safe_custom_bishop_move(board: chess.Board, move: chess.Move) -> bool:
    if not is_bishop_phase_move(board, move):
        return False
    piece = board.piece_at(move.from_square)
    if not piece:
        return False
    test_board = board.copy(stack=False)
    test_board.remove_piece_at(move.from_square)
    test_board.remove_piece_at(move.to_square)
    test_board.set_piece_at(move.to_square, piece)
    return not test_board.is_check()


def is_non_capturing_bishop_move(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.BISHOP:
        return False
    if board.piece_at(move.to_square) is not None:
        return False
    return move in board.legal_moves


def is_safe_second_bishop_move(board: chess.Board, move: chess.Move) -> bool:
    return is_non_capturing_bishop_move(board, move)


# -------------------------
# Rook Augment Helpers
# -------------------------

def is_triple_rook_move(from_square: int, to_square: int) -> bool:
    from_file, from_rank = square_coords(from_square)
    to_file, to_rank     = square_coords(to_square)
    file_diff = abs(from_file - to_file)
    rank_diff = abs(from_rank - to_rank)
    if file_diff != 0 and rank_diff != 0:
        return False
    return max(file_diff, rank_diff) >= 3


def trigger_rook_move(board: chess.Board, move: chess.Move, piece_type) -> bool:
    if piece_type != chess.ROOK:
        return False
    return is_triple_rook_move(move.from_square, move.to_square)


def is_safe_second_rook_move(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.ROOK:
        return False
    return move in board.legal_moves


# -------------------------
# Queen Augment Helpers
# -------------------------

def is_valid_queen_teleport(board: chess.Board, move: chess.Move) -> bool:
    """
    Queen teleport: move queen to any empty square.
    Must not leave king in check.
    """
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.QUEEN:
        return False
    if board.piece_at(move.to_square) is not None:
        return False  # must be empty — no captures

    test_board = board.copy(stack=False)
    test_board.remove_piece_at(move.from_square)
    test_board.set_piece_at(move.to_square, piece)
    return not test_board.is_check()


# -------------------------
# King Augment Helpers
# -------------------------

def get_orthogonally_adjacent_squares(square: int):
    file, rank = square_coords(square)
    adjacent = []
    for df, dr in [(0,1),(0,-1),(-1,0),(1,0)]:
        nf, nr = file + df, rank + dr
        if 0 <= nf < 8 and 0 <= nr < 8:
            adjacent.append(chess.square(nf, nr))
    return adjacent


def get_king_guarded_squares(board: chess.Board, guarded_side: str, active_augments):
    if not active_augments.get(guarded_side, {}).get("king_guard", False):
        return set()
    king_color  = chess.WHITE if guarded_side == "white" else chess.BLACK
    king_square = board.king(king_color)
    if king_square is None:
        return set()
    return set(get_orthogonally_adjacent_squares(king_square))


def is_blocked_by_king_guard(board: chess.Board, move: chess.Move, moving_side: str, active_augments) -> bool:
    enemy_side = "black" if moving_side == "white" else "white"
    guarded_squares = get_king_guarded_squares(board, enemy_side, active_augments)
    return move.to_square in guarded_squares


def is_safe_custom_king_stride(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.KING:
        return False
    from_file, from_rank = square_coords(move.from_square)
    to_file, to_rank     = square_coords(move.to_square)
    df = abs(to_file - from_file)
    dr = abs(to_rank - from_rank)
    if df == 0 and dr == 0:
        return False
    if df > 2 or dr > 2:
        return False
    if board.piece_at(move.to_square) is not None:
        return False
    temp_board = board.copy()
    temp_board.remove_piece_at(move.from_square)
    temp_board.set_piece_at(move.to_square, piece)
    return not temp_board.is_attacked_by(not piece.color, move.to_square)


def is_safe_king_destination(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.KING:
        return False
    temp_board = board.copy()
    temp_board.remove_piece_at(move.from_square)
    temp_board.set_piece_at(move.to_square, piece)
    return not temp_board.is_attacked_by(not piece.color, move.to_square)