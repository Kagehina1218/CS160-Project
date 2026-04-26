import chess


def square_coords(square: int):
    return chess.square_file(square), chess.square_rank(square)


def get_piece_side(piece: chess.Piece) -> str:
    return "white" if piece.color == chess.WHITE else "black"

# -------------------------
# Pawn Augment Helpers
# -------------------------

# -------------------------
# Knight Augment Helpers
# -------------------------
def is_extended_knight_move(from_square: int, to_square: int) -> bool:
    from_file, from_rank = square_coords(from_square)
    to_file, to_rank = square_coords(to_square)

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

    # Simulate the move manually and make sure it does not leave king in check
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
    to_file, to_rank = square_coords(to_square)

    return abs(from_file - to_file) == abs(from_rank - to_rank)


def get_path_squares(from_square: int, to_square: int):
    from_file, from_rank = square_coords(from_square)
    to_file, to_rank = square_coords(to_square)

    file_step = 1 if to_file > from_file else -1
    rank_step = 1 if to_rank > from_rank else -1

    path = []
    current_file = from_file + file_step
    current_rank = from_rank + rank_step

    while current_file != to_file and current_rank != to_rank:
        path.append(chess.square(current_file, current_rank))
        current_file += file_step
        current_rank += rank_step

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
    blocking_pieces = sum(
        1 for square in path_squares if board.piece_at(square) is not None
    )

    # Standard bishop moves already cover zero blockers.
    # Bishop phase is for passing through exactly one blocker.
    return blocking_pieces == 1


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


# -------------------------
# Queen Augment Helpers
# -------------------------


# -------------------------
# King Augment Helpers
# -------------------------
def get_orthogonally_adjacent_squares(square: int):
    file = chess.square_file(square)
    rank = chess.square_rank(square)

    adjacent = []

    offsets = [
        (0, 1),   # up
        (0, -1),  # down
        (-1, 0),  # left
        (1, 0),   # right
    ]

    for df, dr in offsets:
        new_file = file + df
        new_rank = rank + dr

        if 0 <= new_file < 8 and 0 <= new_rank < 8:
            adjacent.append(chess.square(new_file, new_rank))

    return adjacent

def get_king_guarded_squares(board: chess.Board, guarded_side: str, active_augments):
    if not active_augments.get(guarded_side, {}).get("king_guard", False):
        return set()

    king_color = chess.WHITE if guarded_side == "white" else chess.BLACK
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

    # Must move a king
    if not piece or piece.piece_type != chess.KING:
        return False

    from_file, from_rank = square_coords(move.from_square)
    to_file, to_rank = square_coords(move.to_square)

    df = abs(to_file - from_file)
    dr = abs(to_rank - from_rank)

    # Cannot stay in place
    if df == 0 and dr == 0:
        return False

    # Must be within 2 squares in both directions
    if df > 2 or dr > 2:
        return False

    # Destination must be empty (no captures allowed)
    if board.piece_at(move.to_square) is not None:
        return False

    # Simulate move
    temp_board = board.copy()
    temp_board.remove_piece_at(move.from_square)
    temp_board.set_piece_at(move.to_square, piece)

    moving_color = piece.color
    enemy_color = not moving_color

    # The moved king cannot end on an attacked square
    return not temp_board.is_attacked_by(enemy_color, move.to_square)

def is_safe_king_destination(board: chess.Board, move: chess.Move) -> bool:
    piece = board.piece_at(move.from_square)

    if not piece or piece.piece_type != chess.KING:
        return False

    temp_board = board.copy()
    temp_board.remove_piece_at(move.from_square)
    temp_board.set_piece_at(move.to_square, piece)

    enemy_color = not piece.color
    return not temp_board.is_attacked_by(enemy_color, move.to_square)


# -------------------------
# Category 2 Augments Helpers
# -------------------------