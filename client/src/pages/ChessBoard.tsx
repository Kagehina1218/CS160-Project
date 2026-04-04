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
      body: JSON.stringify({ move }),
    });

    const data: MoveResponse = await res.json();
    if (data.status == "ok") {
      setPosition(data.fen);

      if (data.is_checkmate) {
        setStatus("Checkmate!");
      }
      else {
        setStatus(`Turn: ${data.turn}`);
      }

      return true;
    }
    else {
      setStatus("Illegal move");
      return false;
    }
  };

  // Reset
  const resetGame = async () => {
    const res = await fetch("/api/reset", {
      method: "POST",
    });

    const data = await res.json();
    setPosition(data.fen);
    setStatus("");
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1>Match</h1>

      <div style={{ width: "400px", margin: "auto" }}>
        <Chessboard 
          position={position}
          onPieceDrop={onDrop}
          id='click-or-drag-to-move'
        />
      </div>

      <p>{status}</p>

      <button onClick={resetGame}>Reset Game</button>
    </div>
  );
}