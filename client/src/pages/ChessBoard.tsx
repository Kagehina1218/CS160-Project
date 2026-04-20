import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import AugmentPanel from "../components/AugmentPanel";

// -------------------------
// Type Definitions
// -------------------------
type MoveResponse = {
  status: string;
  fen: string;
  turn: string;
  is_checkmate: boolean;
};

type AugmentMap = Record<string, boolean>;

type SideAugments = {
  white: AugmentMap;
  black: AugmentMap;
};

// -------------------------
// Component
// -------------------------
export default function ChessBoard() {
  // -------------------------
  // State
  // -------------------------
  const [position, setPosition] = useState<string>("start");
  const [status, setStatus] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [activeAugments, setActiveAugments] = useState<SideAugments>({
    white: {},
    black: {},
  });

  type HighlightMove = {
    square: string;
    isCapture: boolean;
  };

  type BlockedMove = {
    square: string;
    reason: string;
  };

  const [highlightedSquares, setHighlightedSquares] = useState<HighlightMove[]>([]);
  const [blockedSquares, setBlockedSquares] = useState<BlockedMove[]>([]);

  // -------------------------
  // Backend Fetch Helpers
  // -------------------------
  const fetchAugments = async () => {
    try {
      const res = await fetch("/api/augments");
      const data = await res.json();

      if (data.status === "ok") {
        setActiveAugments(data.active_augments || { white: {}, black: {} });
      }
    } catch (error) {
      console.error("Failed to fetch augments:", error);
    }
  };

  const fetchLegalMoves = async (square: string) => {
    try {
      const res = await fetch(`/api/legal-moves/${square}`);
      const data = await res.json();

      if (data.status === "ok") {
        const legalMoves = data.moves || [];
        const blockedMoves = data.blocked_moves || [];

        if (legalMoves.length === 0 && blockedMoves.length === 0) {
          clearHighlights();
        } else {
          setSelectedSquare(square);
          setHighlightedSquares(
            legalMoves.map((move: any) => ({
              square: move.square,
              isCapture: move.is_capture,
            }))
          );
          setBlockedSquares(blockedMoves);
        }

        if (data.message) {
          setStatus(data.message);
        }
      }
    } catch (error) {
      console.error("Failed to fetch legal moves:", error);
      setSelectedSquare(null);
      setHighlightedSquares([]);
      setBlockedSquares([]);
    }
  };

  const toggleAugment = async (side: "white" | "black", augmentName: string) => {
    try {
      const res = await fetch("/api/augments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          side,
          augment: augmentName,
        }),
      });

      const data = await res.json();

      if (data.status === "ok") {
        setActiveAugments(
          data.active_augments || { white: {}, black: {} }
        );
        clearHighlights();
      } else {
        console.error("Failed to toggle augment:", data.message);
      }
    } catch (error) {
      console.error("Failed to toggle augment:", error);
    }
  };

  // -------------------------
  // UI Helpers
  // -------------------------
  const clearHighlights = () => {
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setBlockedSquares([]);
  };

  // Reset game manually
  const resetGame = async () => {
    const res = await fetch("/api/reset", {
      method: "POST",
    });

    const data = await res.json();
    setPosition(data.fen);
    clearHighlights();
    void fetchAugments();
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

  // -------------------------
  // Board Interaction Handlers
  // -------------------------
  // Handle movement
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    const move = sourceSquare + targetSquare;

    const sendMove = async () => {
      try {
        const res = await fetch("/api/move", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ move }),
        });

        const data = await res.json();

        if (data.status === "ok") {
          setPosition(data.fen);
          setStatus(data.message || "");
          clearHighlights();
        } else {
          setStatus(data.message || "");
        }
      } catch (error) {
        console.error("Move failed:", error);
        setStatus("Failed to make move");
      }
    };

    void sendMove();

    return true;
  };

  // -------------------------
  // Effects
  // -------------------------
  // Load initial board
  useEffect(() => {
    fetch("/api/board")
      .then((res) => res.json())
      .then((data) => {
        setPosition(data.fen);
      });
    void fetchAugments();
  }, []);

  
  // -------------------------
  // Board Styles
  // -------------------------
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

  // Highlight for legal moves
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: "rgba(255, 255, 0, 0.4)",
    };
  }

  highlightedSquares.forEach(({ square, isCapture }) => {
    if (isCapture) {
      customSquareStyles[square] = {
        backgroundColor: "rgba(255, 0, 0, 0.35)",
        boxShadow: "inset 0 0 0 4px rgba(255, 0, 0, 0.6)",
      };
    } else {
      customSquareStyles[square] = {
        background:
          "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 26%)",
        borderRadius: "50%",
      };
    }
  });

  blockedSquares.forEach(({ square, reason }) => {
    if (reason === "king_guard") {
      customSquareStyles[square] = {
        boxShadow: "inset 0 0 0 4px rgba(255, 165, 0, 0.9)",
        backgroundColor: "rgba(255, 165, 0, 0.18)",
      };
    } else if (reason === "second_bishop_move_no_capture") {
      customSquareStyles[square] = {
        boxShadow: "inset 0 0 0 4px rgba(120, 120, 255, 0.9)",
        backgroundColor: "rgba(120, 120, 255, 0.16)",
      };
    } else if (reason === "king_in_check") {
      customSquareStyles[square] = {
        boxShadow: "inset 0 0 0 4px rgba(255, 80, 80, 0.95)",
        backgroundColor: "rgba(255, 80, 80, 0.18)",
      };
    } else if (reason === "king_stride_no_capture") {
      customSquareStyles[square] = {
        boxShadow: "inset 0 0 0 4px rgba(180, 180, 180, 0.95)",
        backgroundColor: "rgba(180, 180, 180, 0.20)",
      };
    } else {
      customSquareStyles[square] = {
        boxShadow: "inset 0 0 0 4px rgba(150, 150, 150, 0.9)",
        backgroundColor: "rgba(150, 150, 150, 0.14)",
      };
    }
  });

  // -------------------------
  // Render
  // -------------------------
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

      {/* Main Layout: Board + Augments */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: "2rem",
          marginTop: "20px",
        }}
      >
        {/* LEFT SIDE: Chessboard + controls */}
        <div>
          <div style={{ width: "400px" }}>
            <Chessboard
              position={position}
              onPieceDrop={onDrop}
              onSquareClick={fetchLegalMoves}
              onPieceDragBegin={(piece, sourceSquare) => {
                void fetchLegalMoves(sourceSquare);
              }}
              customSquareStyles={customSquareStyles}
              id="click-or-drag-to-move"
            />
          </div>

          {/* Status */}
          <p>{status}</p>

          {/* Reset Button */}
          <button onClick={resetGame}>Reset Game</button>

          {/* Back Button */}
          <button onClick={() => (window.location.href = "/")}>
            Back to Home
          </button>
        </div>

        <AugmentPanel
          activeAugments={activeAugments}
          onToggleAugment={toggleAugment}
          devMode={true}
        />
      </div>
    </div>
  );
}