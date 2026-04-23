import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";

type MoveResponse = {
  status: string;
  fen: string;
  turn: string;
  is_checkmate: boolean;
};

export default function ChessBoard() {
  const [position, setPosition] = useState<string>("start");
  const [status, setStatus] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("easy");

  // Load initial board
  useEffect(() => {
    fetch("/api/board")
      .then((res) => res.json())
      .then((data) => {
        setPosition(data.fen);
      });
  }, []);

  // Handle movement
  const onDrop = async (sourceSquare: string, targetSquare: string) => {
    const move = sourceSquare + targetSquare;

    const res = await fetch("/api/move", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ move, difficulty }),
    });

    const data: MoveResponse = await res.json();

    if (data.status === "ok") {
      setPosition(data.fen);

      if (data.is_checkmate) {
        setStatus("Checkmate!");
      } else {
        setStatus(`Turn: ${data.turn} | Mode: ${difficulty}`);
      }

      return true;
    } else {
      setStatus("Illegal move");
      return false;
    }
  };

  // Reset game manually
  const resetGame = async () => {
    const res = await fetch("/api/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ difficulty }),
    });

    const data = await res.json();
    setPosition(data.fen);
    setStatus(`New game (${difficulty})`);
  };

  // Change difficulty + reset automatically
  const changeDifficulty = async (level: string) => {
    setDifficulty(level);

    const res = await fetch("/api/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ difficulty: level }),
    });

    const data = await res.json();
    setPosition(data.fen);
    setStatus(`New game (${level})`);
  };

  // Button styling
  const getButtonStyle = (level: string) => ({
    padding: "10px 15px",
    margin: "5px",
    border: "none",
    cursor: "pointer",
    borderRadius: "5px",
    backgroundColor: difficulty === level ? "#4CAF50" : "#ccc",
    color: difficulty === level ? "white" : "black",
    fontWeight: difficulty === level ? "bold" : "normal",
  });

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Match</h1>

      {/* Difficulty Buttons */}
      <div>
        <h3>Select Difficulty</h3>

        <button
          style={getButtonStyle("easy")}
          onClick={() => changeDifficulty("easy")}
        >
          Easy
        </button>

        <button
          style={getButtonStyle("medium")}
          onClick={() => changeDifficulty("medium")}
        >
          Medium
        </button>

        <button
          style={getButtonStyle("hard")}
          onClick={() => changeDifficulty("hard")}
        >
          Hard
        </button>
      </div>

      {/* Chessboard */}
      <div style={{ width: "400px", margin: "20px auto" }}>
        <Chessboard
          position={position}
          onPieceDrop={onDrop}
          id="click-or-drag-to-move"
        />
      </div>

      {/* Status */}
      <p>{status}</p>

      {/* Reset Button */}
      <button onClick={resetGame}>Reset Game</button>

      {/* Reset Button */}
      <button onClick={() => (window.location.href = "/")}> 
        Back to Home
      </button>
    </div>
  );
}