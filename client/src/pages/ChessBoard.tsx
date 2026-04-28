import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import AugmentPanel from "../components/AugmentPanel";
import AugmentDraftPopup from "../components/AugmentPopup"; // ADD THIS

// -------------------------
// Type Definitions
// -------------------------
type MoveResponse = {
  status: string;
  fen: string;
  turn: string;
  is_checkmate: boolean;
  is_stalemate?: boolean;
  winner?: string | null;
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
  const [gameOverMessage, setGameOverMessage] = useState<string>("");
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [activeAugments, setActiveAugments] = useState<SideAugments>({
    white: {},
    black: {},
  });
  const [turnCount, setTurnCount] = useState<number>(0);
  const [boardLocked, setBoardLocked] = useState<boolean>(false); // ADD THIS

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
    if (isGameOver || boardLocked) { // ADD boardLocked check
      clearHighlights();
      return;
    }

    try {
      const res = await fetch(`/api/legal-moves/${square}`);
      const data = await res.json();

      if (data.status === "ok") {
        if (updateGameOverStatus(data)) {
          clearHighlights();
          return;
        }

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

  const resetGame = async () => {
    const res = await fetch("/api/reset", {
      method: "POST",
    });

    const data = await res.json();
    setPosition(data.fen);
    setStatus("");
    setIsGameOver(false);
    setGameOverMessage("");
    setShowGameOverOverlay(false);
    setTurnCount(0);
    setBoardLocked(false); // ADD THIS
    clearHighlights();
    void fetchAugments();
  };

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
    setIsGameOver(false);
    setGameOverMessage("");
    setShowGameOverOverlay(false);
    setTurnCount(0);
    setBoardLocked(false); // ADD THIS
    clearHighlights();
  };

  // -------------------------
  // Board Interaction Handlers
  // -------------------------
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isGameOver || boardLocked) return false; // ADD boardLocked check

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

          if (data.turn_count !== undefined) {
            setTurnCount(data.turn_count);
          }

          if (!updateGameOverStatus(data)) {
            setStatus(data.message || "");
          }

          clearHighlights();

          // ADD THIS: disable the augment after White's move completes
          await disableAllWhiteAugments();
          void fetchAugments();
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

  // ADD THIS: turns off every white augment after the move resolves
  const disableAllWhiteAugments = async () => {
    try {
      const res = await fetch("/api/augments");
      const data = await res.json();
      const currentWhite: AugmentMap = data.active_augments?.white ?? {};

      for (const [aug, isOn] of Object.entries(currentWhite)) {
        if (isOn) {
          await fetch("/api/augments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ side: "white", augment: aug }),
          });
        }
      }
    } catch (err) {
      console.error("Failed to clear white augments:", err);
    }
  };

  const updateGameOverStatus = (data: any) => {
    if (data.is_checkmate) {
      const message = data.winner
        ? `Checkmate - ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins`
        : "Checkmate";

      setStatus(message);
      setGameOverMessage(message);
      setIsGameOver(true);
      setShowGameOverOverlay(true);
      return true;
    }

    if (data.is_stalemate) {
      const message = "Stalemate - Draw";
      setStatus(message);
      setGameOverMessage(message);
      setIsGameOver(true);
      setShowGameOverOverlay(true);
      return true;
    }

    setIsGameOver(false);
    setGameOverMessage("");
    setShowGameOverOverlay(true);
    return false;
  };

  // -------------------------
  // Effects
  // -------------------------
  useEffect(() => {
    fetch("/api/board")
      .then((res) => res.json())
      .then((data) => {
        setPosition(data.fen);
        setTurnCount(data.turn_count ?? 0); // ADD THIS — sync turn count on load
        updateGameOverStatus(data);
      });
    void fetchAugments();
  }, []);

  // ADD THIS: lock the board when it's a draft turn (every 3rd turn)
  useEffect(() => {
    if (turnCount > 0 && (turnCount % 3 === 0)) {
      setBoardLocked(true);
    }
  }, [turnCount]);

  // -------------------------
  // Board Styles
  // -------------------------
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
        background: "radial-gradient(circle, rgba(0,0,0,0.25) 25%, transparent 26%)",
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
      <p style={{ margin: "4px 0 12px", color: "#666", fontSize: "14px" }}>
        Turn {turnCount}
      </p>

      {/* ADD THIS: Augment draft popup */}
      <AugmentDraftPopup
        turnCount={turnCount}
        onDraftComplete={() => {
          void fetchAugments();
          setBoardLocked(false);
        }}
      />

      {/* Difficulty Buttons */}
      <div>
        <h3>Select Difficulty</h3>
        <button style={getButtonStyle("easy")} onClick={() => changeDifficulty("easy")}>Easy</button>
        <button style={getButtonStyle("medium")} onClick={() => changeDifficulty("medium")}>Medium</button>
        <button style={getButtonStyle("hard")} onClick={() => changeDifficulty("hard")}>Hard</button>
      </div>

      {/* Main Layout */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "2rem",
        marginTop: "20px",
      }}>
        {/* LEFT: Board + controls */}
        <div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
            width: "400px",
          }}>
            <strong>{status}</strong>

            <div style={{ position: "relative", display: "flex", gap: "8px" }}>
              {isGameOver && !showGameOverOverlay && (
                <button onClick={() => setShowGameOverOverlay(true)}>Show Result</button>
              )}
              <button onClick={() => setShowSettingsMenu((prev) => !prev)}>Settings</button>

              {showSettingsMenu && (
                <div style={{
                  position: "absolute",
                  right: 0,
                  top: "110%",
                  backgroundColor: "white",
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  zIndex: 20,
                  minWidth: "140px",
                }}>
                  <button onClick={() => { setShowSettingsMenu(false); void resetGame(); }}>
                    Reset Game
                  </button>
                  <button onClick={() => { setShowSettingsMenu(false); window.location.href = "/"; }}>
                    Back to Home
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ width: "400px", position: "relative" }}>
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

            {/* ADD THIS: dim the board while locked */}
            {boardLocked && !isGameOver && (
              <div style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.35)",
                borderRadius: "8px",
                zIndex: 5,
                pointerEvents: "none",
              }} />
            )}

            {isGameOver && showGameOverOverlay && (
              <div style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.55)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                borderRadius: "8px",
                zIndex: 10,
                color: "white",
                padding: "20px",
                textAlign: "center",
              }}>
                <h2 style={{ marginBottom: "16px" }}>{gameOverMessage}</h2>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={resetGame}>Play Again</button>
                  <button onClick={() => setShowGameOverOverlay(false)}>View Board</button>
                  <button onClick={() => (window.location.href = "/")}>Back to Home</button>
                </div>
              </div>
            )}
          </div>
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