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


# -------------------------
# Category 2 Augments Helpers
# -------------------------
