import os
import json

MESSAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "messages")
VALID_DIFFICULTIES = {"easy", "medium", "hard"}

def get_messages_file_path(difficulty: str) -> str:
    if difficulty not in VALID_DIFFICULTIES:
        raise ValueError("Invalid difficulty")

    os.makedirs(MESSAGES_DIR, exist_ok=True)
    return os.path.join(MESSAGES_DIR, f"{difficulty}.json")

def load_messages(difficulty: str):
    file_path = get_messages_file_path(difficulty)

    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump([], f)

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_messages(difficulty: str, messages):
    file_path = get_messages_file_path(difficulty)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2)