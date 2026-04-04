import pytest
from backend.app import app

@pytest.fixture
def client():
  app.config['TESTING'] = True
  return app.test_client()

def test_get_board(client):
  response = client.get('/board')
  assert response.status_code == 200

  data = response.get_json()
  print("Response:", data)
  assert "fen" in data
  assert data["turn"] == "white"

def test_valid_move(client):
  response = client.post('/move', json={"move": "e2e4"})
  assert response.status_code == 200

  data = response.get_json()
  print("Response:", data)
  assert data["status"] == "ok"
  assert data["turn"] == "black"

def test_illegal_move(client):
  response = client.post('/move', json={"move": "e2e5"})

  data = response.get_json()
  print("Response:", data)
  assert data["status"] == "illegal"

def test_reset(client):
  client.post('/move', json={"move": "e2e4"})
  response = client.post('/reset')

  data = response.get_json()
  print("Response:", data)
  assert "fen" in data
  assert " w " in data["fen"]