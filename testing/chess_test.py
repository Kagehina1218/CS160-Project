import pytest
from unittest.mock import patch
from backend.app import app
from backend.game_state import board


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        # Reset board state before every test so tests are independent
        board.reset()
        yield client


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

def test_get_board(client):
    response = client.get("/board")
    assert response.status_code == 200

    data = response.get_json()
    assert "fen" in data
    assert data["turn"] == "white"
    assert data["is_checkmate"] is False
    assert data["is_stalemate"] is False


# ---------------------------------------------------------------------------
# Move
# ---------------------------------------------------------------------------

def test_valid_move(client):
    response = client.post("/move", json={"move": "e2e4"})
    assert response.status_code == 200

    data = response.get_json()
    assert data["status"] == "ok"
    # After white's move the AI (black) moves, so it might be white's turn again
    assert data["turn"] in ("white", "black")
    assert "fen" in data


def test_illegal_move(client):
    # Board is reset in fixture so e2e5 is always illegal from starting position
    response = client.post("/move", json={"move": "e2e5"})
    data = response.get_json()
    assert data["status"] == "illegal"


def test_invalid_move_format(client):
    response = client.post("/move", json={"move": "notamove"})
    data = response.get_json()
    assert data["status"] in ("illegal", "error")


def test_move_no_piece(client):
    # e4 is empty at start
    response = client.post("/move", json={"move": "e4e5"})
    data = response.get_json()
    assert data["status"] == "illegal"


# ---------------------------------------------------------------------------
# Legal moves
# ---------------------------------------------------------------------------

def test_legal_moves_starting_pawn(client):
    response = client.get("/legal-moves/e2")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    squares = [m["square"] for m in data["moves"]]
    assert "e3" in squares
    assert "e4" in squares


def test_legal_moves_empty_square(client):
    response = client.get("/legal-moves/e4")
    assert response.status_code == 200
    data = response.get_json()
    assert data["moves"] == []


def test_legal_moves_invalid_square(client):
    response = client.get("/legal-moves/z9")
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

def test_reset(client):
    # Make a move first
    client.post("/move", json={"move": "e2e4"})
    # Then reset
    response = client.post("/reset")
    assert response.status_code == 200

    data = response.get_json()
    assert "fen" in data
    assert " w " in data["fen"]  # white to move
    assert "difficulty" in data


# ---------------------------------------------------------------------------
# Difficulty
# ---------------------------------------------------------------------------

def test_get_difficulty(client):
    response = client.get("/difficulty")
    assert response.status_code == 200
    data = response.get_json()
    assert data["difficulty"] in ("easy", "medium", "hard")


def test_set_difficulty_valid(client):
    response = client.post("/difficulty", json={"difficulty": "hard"})
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["difficulty"] == "hard"

    # Reset difficulty back to medium so other tests aren't affected
    client.post("/difficulty", json={"difficulty": "medium"})


def test_set_difficulty_invalid(client):
    response = client.post("/difficulty", json={"difficulty": "impossible"})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Augments
# ---------------------------------------------------------------------------

def test_get_augments(client):
    response = client.get("/augments")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert "active_augments" in data
    assert "white" in data["active_augments"]
    assert "black" in data["active_augments"]


def test_toggle_augment(client):
    # Toggle knight_long_jump for white on
    response = client.post("/augments", json={"side": "white", "augment": "knight_long_jump"})
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["active_augments"]["white"]["knight_long_jump"] is True

    # Toggle it back off
    response = client.post("/augments", json={"side": "white", "augment": "knight_long_jump"})
    data = response.get_json()
    assert data["active_augments"]["white"]["knight_long_jump"] is False


def test_toggle_augment_invalid_side(client):
    response = client.post("/augments", json={"side": "purple", "augment": "knight_long_jump"})
    assert response.status_code == 400


def test_toggle_augment_invalid_name(client):
    response = client.post("/augments", json={"side": "white", "augment": "super_laser"})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Auth-protected endpoints (expect 401 without token)
# ---------------------------------------------------------------------------

def test_profile_requires_auth(client):
    response = client.get("/profile")
    assert response.status_code == 401


def test_leaderboard_requires_auth(client):
    response = client.get("/leaderboard")
    assert response.status_code == 401


def test_games_requires_auth(client):
    response = client.get("/games")
    assert response.status_code == 401


def test_stats_requires_auth(client):
    response = client.get("/stats")
    assert response.status_code == 401


def test_messages_get_requires_auth(client):
    response = client.get("/messages/easy")
    assert response.status_code == 401


def test_messages_post_requires_auth(client):
    response = client.post("/messages/easy", json={"message": "hello"})
    assert response.status_code == 401