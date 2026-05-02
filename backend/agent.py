import os
import chess
import chess.engine

ENGINE_PATH = "..\engine\stockfish.exe"
engine = None

try:
    engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
    print("Stockfish loaded")
except:
    print("Stockfish not found")


piece_values = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0
}

def evaluate(board):
    score = 0
    for piece_type in piece_values:
        score += len(board.pieces(piece_type, chess.WHITE)) * piece_values[piece_type]
        score -= len(board.pieces(piece_type, chess.BLACK)) * piece_values[piece_type]
    return score

def alphabeta(board, depth, alpha, beta, maximizing):
    if depth == 0 or board.is_game_over():
        return evaluate(board)

    if maximizing:
        max_eval = -float("inf")
        for move in board.legal_moves:
            board.push(move)
            eval = alphabeta(board, depth - 1, alpha, beta, False)
            board.pop()
            max_eval = max(max_eval, eval)
            alpha = max(alpha, eval)
            if beta <= alpha:
                break
        return max_eval
    else:
        min_eval = float("inf")
        for move in board.legal_moves:
            board.push(move)
            eval = alphabeta(board, depth - 1, alpha, beta, True)
            board.pop()
            min_eval = min(min_eval, eval)
            beta = min(beta, eval)
            if beta <= alpha:
                break
        return min_eval

def get_best_move(board, depth):
    best_move = None

    if board.turn == chess.WHITE:
        best_value = -float("inf")
        for move in board.legal_moves:
            board.push(move)
            value = alphabeta(board, depth - 1, -float("inf"), float("inf"), False)
            board.pop()
            if value > best_value:
                best_value = value
                best_move = move
    else:
        best_value = float("inf")
        for move in board.legal_moves:
            board.push(move)
            value = alphabeta(board, depth - 1, -float("inf"), float("inf"), True)
            board.pop()
            if value < best_value:
                best_value = value
                best_move = move

    return best_move.uci() if best_move else None

def get_stockfish_move(board):
    if engine:
        result = engine.play(board, chess.engine.Limit(time=0.1))
        return result.move.uci()
    return None

def get_ai_move(board, difficulty):
    if difficulty == "easy":
        return get_best_move(board, depth=1)
    elif difficulty == "medium":
        return get_best_move(board, depth=2)
    else:
        return get_stockfish_move(board)