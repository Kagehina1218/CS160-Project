import { useEffect, useState, useCallback, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import AugmentPanel from "../components/AugmentPanel";
import AugmentDraftPopup, { type OwnedAugment, type PieceType } from "../components/AugmentPopup";

// -------------------------
// Types
// -------------------------
type MoveEntry = {
  move_uci: string;
  san: string;
  side: "white" | "black";
  turn: number;
};

type MoveResponse = {
  status: string;
  fen: string;
  turn: string;
  is_checkmate: boolean;
  is_stalemate?: boolean;
  winner?: string | null;
  message?: string;
  turn_count?: number;
  move_history?: MoveEntry[];
  damaged_pawns?: number[];
  queen_teleport_used?: { white: boolean; black: boolean };
};

type LegalMoveEntry = { square: string; is_capture: boolean; is_teleport?: boolean };
type BlockedMoveEntry = { square: string; reason: string };
type AugmentMap = Record<string, boolean>;
type SideAugments = { white: AugmentMap; black: AugmentMap };

// -------------------------
// Utility: piece type from FEN + source square
// -------------------------

/**
 * Returns the PieceType for whichever white piece sits on `square` in the
 * given FEN. Returns null for black pieces, empty squares, or out-of-range.
 * Covers all 6 piece types so augment consumption works for pawn, rook, and
 * queen augments that are now part of the draft pool.
 */
function pieceTypeFromFenSquare(fen: string, square: string): PieceType | null {
  const fenBoard = fen.split(" ")[0];
  const ranks    = fenBoard.split("/");

  const file = square.charCodeAt(0) - "a".charCodeAt(0); // 0-7
  const rank = parseInt(square[1], 10) - 1;               // 0-7
  const fenRank = ranks[7 - rank];

  let col = 0;
  for (const ch of fenRank) {
    if (ch >= "1" && ch <= "8") {
      col += parseInt(ch, 10);
    } else {
      if (col === file) {
        // Uppercase = white pieces
        switch (ch) {
          case "P": return "pawn";
          case "N": return "knight";
          case "B": return "bishop";
          case "R": return "rook";
          case "Q": return "queen";
          case "K": return "king";
          default:  return null; // black piece or unexpected char
        }
      }
      col++;
    }
  }
  return null;
}

function squareIndexToName(index: number): string | null {
  const files = ["a","b","c","d","e","f","g","h"];
  const file  = index % 8;
  const rank  = Math.floor(index / 8);
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${files[file]}${rank + 1}`;
}

// -------------------------
// Styles
// -------------------------
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;1,300&display=swap');

  .chess-page {
    min-height: 100vh;
    background: radial-gradient(ellipse at 20% 50%, #162032 0%, #111827 40%, #0c1220 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px 40px;
    font-family: 'Crimson Pro', Georgia, serif;
    position: relative;
    overflow-x: hidden;
  }

  .chess-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(circle at 15% 25%, rgba(99,102,241,0.13) 0%, transparent 45%),
      radial-gradient(circle at 85% 75%, rgba(168,85,247,0.09) 0%, transparent 45%);
    pointer-events: none;
    z-index: 0;
  }

  .chess-header { text-align: center; margin-bottom: 20px; position: relative; z-index: 1; }

  .chess-title {
    font-family: 'Cinzel', serif;
    font-size: 2.6rem;
    font-weight: 700;
    margin: 0 0 2px;
    background: linear-gradient(135deg, #e2c97e 0%, #f5e6b2 45%, #c9a84c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: 0.06em;
    filter: drop-shadow(0 0 20px rgba(226,201,126,0.25));
  }

  .chess-subtitle { font-family: 'Crimson Pro', serif; font-style: italic; color: #64748b; font-size: 1rem; letter-spacing: 0.08em; }

  .difficulty-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; position: relative; z-index: 1; }
  .diff-btn { font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em; padding: 9px 22px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #64748b; cursor: pointer; transition: all 0.22s ease; text-transform: uppercase; }
  .diff-btn:hover { border-color: rgba(226,201,126,0.3); color: #e2c97e; background: rgba(226,201,126,0.06); }
  .diff-btn.active { background: linear-gradient(135deg, rgba(226,201,126,0.2), rgba(196,160,70,0.15)); border-color: rgba(226,201,126,0.55); color: #f5e6b2; box-shadow: 0 0 18px rgba(226,201,126,0.15), inset 0 1px 0 rgba(255,255,255,0.08); }

  .main-arena { display: flex; align-items: flex-start; gap: 20px; position: relative; z-index: 1; width: 100%; max-width: 1200px; justify-content: center; }

  .history-panel { width: 190px; flex-shrink: 0; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 16px; backdrop-filter: blur(12px); max-height: 560px; display: flex; flex-direction: column; }
  .history-title { font-family: 'Cinzel', serif; font-size: 0.65rem; letter-spacing: 0.18em; color: #e2c97e; margin: 0 0 12px; text-transform: uppercase; }
  .history-head { display: grid; grid-template-columns: 22px 1fr 1fr; gap: 4px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 6px; font-family: 'Cinzel', serif; font-size: 0.62rem; color: #475569; letter-spacing: 0.08em; }
  .history-scroll { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: rgba(226,201,126,0.2) transparent; }
  .history-row { display: grid; grid-template-columns: 22px 1fr 1fr; gap: 4px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03); }
  .history-num { color: #334155; font-size: 0.75rem; }
  .history-white { color: #f1f5f9; font-size: 0.8rem; font-family: 'Courier New', monospace; }
  .history-black { color: #94a3b8; font-size: 0.8rem; font-family: 'Courier New', monospace; }
  .history-empty { color: #2d3748; font-style: italic; font-size: 0.78rem; }

  .board-column { display: flex; flex-direction: column; align-items: center; gap: 0; }
  .board-topbar { display: flex; justify-content: space-between; align-items: center; width: 480px; margin-bottom: 10px; }
  .status-text { font-family: 'Crimson Pro', serif; font-style: italic; font-size: 1.1rem; color: #94a3b8; min-height: 1.4em; transition: color 0.3s ease; }
  .status-text.alert { color: #fbbf24; }
  .board-controls { display: flex; gap: 8px; align-items: center; }

  .ctrl-btn { font-family: 'Cinzel', serif; font-size: 0.7rem; letter-spacing: 0.08em; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #94a3b8; cursor: pointer; transition: all 0.2s ease; text-transform: uppercase; }
  .ctrl-btn:hover { border-color: rgba(255,255,255,0.2); color: #f1f5f9; background: rgba(255,255,255,0.08); }
  .ctrl-btn.danger { border-color: rgba(239,68,68,0.3); color: #f87171; background: rgba(239,68,68,0.07); }
  .ctrl-btn.danger:hover { border-color: rgba(239,68,68,0.6); background: rgba(239,68,68,0.15); }

  .board-wrapper { position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 0 0 1px rgba(226,201,126,0.12), 0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(99,102,241,0.06); }

  .board-lock-dim { position: absolute; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(1px); z-index: 8; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
  .board-lock-label { font-family: 'Cinzel', serif; font-size: 0.75rem; letter-spacing: 0.18em; color: rgba(226,201,126,0.75); text-transform: uppercase; text-shadow: 0 0 12px rgba(226,201,126,0.4); }

  .legend { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; margin-top: 14px; width: 480px; }
  .legend-item { display: flex; align-items: center; gap: 6px; font-family: 'Crimson Pro', serif; font-size: 0.82rem; color: #64748b; letter-spacing: 0.02em; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  .board-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 20; text-align: center; padding: 30px; }
  .overlay-gameover { background: linear-gradient(135deg, rgba(5,8,16,0.92), rgba(10,15,30,0.95)); backdrop-filter: blur(8px); }
  .overlay-forfeit { background: linear-gradient(135deg, rgba(15,5,5,0.93), rgba(30,5,5,0.95)); backdrop-filter: blur(8px); }
  .overlay-title { font-family: 'Cinzel', serif; font-size: 2rem; font-weight: 700; margin: 0 0 8px; background: linear-gradient(135deg, #e2c97e, #f5e6b2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .overlay-sub { font-family: 'Crimson Pro', serif; font-style: italic; color: #64748b; margin: 0 0 28px; font-size: 1rem; }
  .overlay-sub.danger { color: #f87171; }
  .overlay-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .overlay-btn { font-family: 'Cinzel', serif; font-size: 0.72rem; letter-spacing: 0.1em; padding: 11px 22px; border-radius: 10px; border: 1px solid rgba(226,201,126,0.3); background: rgba(226,201,126,0.08); color: #e2c97e; cursor: pointer; text-transform: uppercase; transition: all 0.2s ease; }
  .overlay-btn:hover { background: rgba(226,201,126,0.18); border-color: rgba(226,201,126,0.55); box-shadow: 0 0 20px rgba(226,201,126,0.12); }
  .overlay-btn.red { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.1); color: #f87171; }
  .overlay-btn.red:hover { background: rgba(239,68,68,0.22); border-color: rgba(239,68,68,0.65); }
  .overlay-btn.ghost { border-color: rgba(255,255,255,0.1); background: transparent; color: #64748b; }
  .overlay-btn.ghost:hover { background: rgba(255,255,255,0.06); color: #94a3b8; }

  .error-banner { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 10px 18px; border-radius: 10px; margin-bottom: 14px; font-family: 'Crimson Pro', serif; font-size: 0.92rem; max-width: 480px; text-align: center; }

  .timer-toggle-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 14px; width: 480px; }
  .timer-opt-btn { font-family: 'Cinzel', serif; font-size: 0.68rem; letter-spacing: 0.09em; padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #94a3b8; cursor: pointer; transition: all 0.2s ease; text-transform: uppercase; }
  .timer-opt-btn:hover { border-color: rgba(226,201,126,0.25); color: #e2c97e; }
  .timer-opt-btn.selected { border-color: rgba(226,201,126,0.45); background: rgba(226,201,126,0.1); color: #e2c97e; }
  .timer-row { display: flex; align-items: center; gap: 16px; justify-content: center; margin-bottom: 14px; width: 480px; }
  .timer-clock { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); min-width: 110px; transition: all 0.3s ease; }
  .timer-clock.active-clock { border-color: rgba(226,201,126,0.35); background: rgba(226,201,126,0.08); box-shadow: 0 0 16px rgba(226,201,126,0.1); }
  .timer-clock.low-time { border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.08); animation: pulse-red 1s ease infinite; }
  @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 18px rgba(239,68,68,0.25); } }
  .timer-side-label { font-family: 'Cinzel', serif; font-size: 0.6rem; letter-spacing: 0.14em; color: #94a3b8; text-transform: uppercase; }
  .timer-digits { font-family: 'Courier New', monospace; font-size: 1.6rem; font-weight: 700; letter-spacing: 0.04em; color: #e2e8f0; transition: color 0.3s ease; }
  .timer-digits.low { color: #f87171; }
  .timer-divider { font-family: 'Cinzel', serif; font-size: 0.7rem; color: #64748b; letter-spacing: 0.1em; }

  .turn-indicator { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .turn-pip { width: 8px; height: 8px; border-radius: 50%; transition: all 0.35s ease; }
  .turn-label { font-family: 'Cinzel', serif; font-size: 0.7rem; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; }
`;

// -------------------------
// Move History Panel
// -------------------------
function MoveHistoryPanel({ history }: { history: MoveEntry[] }) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const whiteMoves = history.filter((m) => m.side === "white");
  const blackMoves = history.filter((m) => m.side === "black");
  const rowCount   = Math.max(whiteMoves.length, blackMoves.length);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length]);

  return (
    <div className="history-panel">
      <div className="history-title">Move History</div>
      <div className="history-head"><span>#</span><span>White</span><span>Black</span></div>
      <div className="history-scroll" ref={scrollRef}>
        {rowCount === 0 ? (
          <div className="history-empty" style={{ paddingTop: "6px" }}>No moves yet.</div>
        ) : (
          Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="history-row">
              <span className="history-num">{i + 1}.</span>
              <span className="history-white">{whiteMoves[i]?.san ?? ""}</span>
              <span className="history-black">{blackMoves[i]?.san ?? ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// -------------------------
// Main Component
// -------------------------
export default function ChessBoard() {
  const { getToken } = useAuth();
  const navigate     = useNavigate();

  // Core game state
  const [position, setPosition]                   = useState<string>("start");
  const [status, setStatus]                       = useState<string>("");
  const [difficulty, setDifficulty]               = useState<string>("medium");
  const [selectedSquare, setSelectedSquare]       = useState<string | null>(null);
  const [gameOverMessage, setGameOverMessage]     = useState<string>("");
  const [isGameOver, setIsGameOver]               = useState<boolean>(false);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState<boolean>(false);
  const [showForfeitConfirm, setShowForfeitConfirm]   = useState<boolean>(false);
  const [activeAugments, setActiveAugments]       = useState<SideAugments>({ white: {}, black: {} });
  const [turnCount, setTurnCount]                 = useState<number>(0);
  const [currentTurn, setCurrentTurn]             = useState<"white" | "black">("white");
  const [moveHistory, setMoveHistory]             = useState<MoveEntry[]>([]);
  const [boardError, setBoardError]               = useState<string>("");
  const [highlightedSquares, setHighlightedSquares] = useState<LegalMoveEntry[]>([]);
  const [blockedSquares, setBlockedSquares]         = useState<BlockedMoveEntry[]>([]);
  const [damagedPawns, setDamagedPawns]             = useState<number[]>([]);
  const [queenTeleportUsed, setQueenTeleportUsed]   = useState<{ white: boolean; black: boolean }>({ white: false, black: false });
  const [boardLocked, setBoardLocked]               = useState<boolean>(false);
  const [gameResetKey, setGameResetKey] = useState(0);

  /**
   * The full augment collection — kept here so both AugmentDraftPopup
   * (which mutates it) and AugmentPanel (which displays it) share one source.
   * AugmentDraftPopup owns the write side; we receive updates via onCollectionChange.
   */
  const [ownedCollection, setOwnedCollection] = useState<OwnedAugment[]>([]);

  /**
   * Piece type of the last white move.
   * Updated in onDrop (pre-move FEN lookup) and passed to AugmentDraftPopup
   * so it can spend the matching held augment.
   */
  const [lastWhiteMovedPieceType, setLastWhiteMovedPieceType] = useState<PieceType | null>(null);

  /**
   * Snapshot of the FEN BEFORE the most recent move — needed to identify
   * which piece is on the source square, since the post-move FEN has already
   * updated the board.
   */
  const preMovePositionRef = useRef<string>("start");

  // Timer state
  const [timerMode, setTimerMode]       = useState<"none" | "1" | "3" | "5" | "10">("none");
  const [whiteTime, setWhiteTime]       = useState<number>(0);
  const [blackTime, setBlackTime]       = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const intervalRef                     = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------
  // Auth
  // -------------------------
  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const token = await getToken();
      return token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
    } catch {
      return { "Content-Type": "application/json" };
    }
  }, [getToken]);

  // -------------------------
  // Helpers
  // -------------------------
  const clearHighlights = useCallback(() => {
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setBlockedSquares([]);
  }, []);

  const handleGameOverStatus = useCallback((data: Partial<MoveResponse>): boolean => {
    if (data.is_checkmate) {
      const msg = data.winner
        ? `${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins by Checkmate`
        : "Checkmate";
      setStatus(msg); setGameOverMessage(msg);
      setIsGameOver(true); setShowGameOverOverlay(true);
      return true;
    }
    if (data.is_stalemate) {
      const msg = "Stalemate — Draw";
      setStatus(msg); setGameOverMessage(msg);
      setIsGameOver(true); setShowGameOverOverlay(true);
      return true;
    }
    return false;
  }, []);

  const applyResponse = useCallback((data: MoveResponse) => {
    setPosition(data.fen);
    if (data.turn_count !== undefined) setTurnCount(data.turn_count);
    if (data.move_history)    setMoveHistory(data.move_history);
    if (data.damaged_pawns)   setDamagedPawns(data.damaged_pawns);
    if (data.queen_teleport_used) setQueenTeleportUsed(data.queen_teleport_used);
    if (data.turn) setCurrentTurn(data.turn as "white" | "black");
    if (!handleGameOverStatus(data)) setStatus(data.message ?? "");
  }, [handleGameOverStatus]);

  // -------------------------
  // Fetchers
  // -------------------------
  const fetchAugments = useCallback(async () => {
    try {
      const h   = await authHeaders();
      const res = await fetch("/api/augments", { headers: h });
      const data = await res.json() as { status: string; active_augments?: SideAugments };
      if (data.status === "ok") setActiveAugments(data.active_augments ?? { white: {}, black: {} });
    } catch (e) { console.error(e); }
  }, [authHeaders]);

  const fetchLegalMoves = useCallback(async (square: string) => {
    if (isGameOver || boardLocked) { clearHighlights(); return; }
    try {
      const h   = await authHeaders();
      const res = await fetch(`/api/legal-moves/${square}`, { headers: h });
      const data = await res.json() as {
        status: string; moves?: LegalMoveEntry[];
        blocked_moves?: BlockedMoveEntry[]; message?: string;
      } & Partial<MoveResponse>;
      if (data.status === "ok") {
        if (handleGameOverStatus(data as MoveResponse)) { clearHighlights(); return; }
        const legal   = data.moves ?? [];
        const blocked = data.blocked_moves ?? [];
        if (legal.length === 0 && blocked.length === 0) clearHighlights();
        else { setSelectedSquare(square); setHighlightedSquares(legal); setBlockedSquares(blocked); }
        if (data.message) setStatus(data.message);
      }
    } catch (e) { console.error(e); clearHighlights(); }
  }, [isGameOver, boardLocked, authHeaders, handleGameOverStatus, clearHighlights]);

  const toggleAugment = useCallback(async (side: "white" | "black", augmentName: string) => {
    try {
      const h   = await authHeaders();
      const res = await fetch("/api/augments", {
        method: "POST", headers: h,
        body: JSON.stringify({ side, augment: augmentName }),
      });
      const data = await res.json() as { status: string; active_augments?: SideAugments };
      if (data.status === "ok") { setActiveAugments(data.active_augments ?? { white: {}, black: {} }); clearHighlights(); }
    } catch (e) { console.error(e); }
  }, [authHeaders, clearHighlights]);

  // -------------------------
  // Game actions
  // -------------------------
  const resetGame = useCallback(async () => {
    try {
      const h   = await authHeaders();
      const res = await fetch("/api/reset", { method: "POST", headers: h });
      const data = await res.json() as { fen: string; active_augments?: SideAugments };
      setPosition(data.fen);
      setActiveAugments(data.active_augments ?? { white: {}, black: {} });
      preMovePositionRef.current = data.fen;
      setStatus(""); setIsGameOver(false);
      setGameOverMessage(""); setShowGameOverOverlay(false);
      setTurnCount(0); setMoveHistory([]); setDamagedPawns([]);
      setQueenTeleportUsed({ white: false, black: false });
      setCurrentTurn("white");
      setBoardLocked(false);
      setLastWhiteMovedPieceType(null);
      setOwnedCollection([]);   // ← reset collection on new game
      clearHighlights();
      setGameResetKey((k) => k + 1);
      void fetchAugments();
    } catch (e) { console.error(e); }
  }, [authHeaders, clearHighlights, fetchAugments]);

  const changeDifficulty = useCallback(async (level: string) => {
    try {
      const h = await authHeaders();
      await fetch("/api/difficulty", { method: "POST", headers: h, body: JSON.stringify({ difficulty: level }) });
      const res  = await fetch("/api/reset", { method: "POST", headers: h });
      const data = await res.json() as { fen: string };
      setDifficulty(level);
      setPosition(data.fen);
      preMovePositionRef.current = data.fen;
      setStatus(`New game — ${level.charAt(0).toUpperCase() + level.slice(1)}`);
      setIsGameOver(false); setGameOverMessage(""); setShowGameOverOverlay(false);
      setTurnCount(0); setMoveHistory([]); setDamagedPawns([]);
      setQueenTeleportUsed({ white: false, black: false });
      setCurrentTurn("white");
      setBoardLocked(false);
      setLastWhiteMovedPieceType(null);
      setOwnedCollection([]);   // ← reset collection on difficulty change
      setGameResetKey((k) => k + 1);
      clearHighlights();
      void fetchAugments();
    } catch (e) { console.error(e); }
  }, [authHeaders, clearHighlights]);

  const handleForfeit = useCallback(async () => {
    try {
      const h = await authHeaders();
      await fetch("/api/forfeit", { method: "POST", headers: h });
      setGameOverMessage("You forfeited the match.");
      setIsGameOver(true); setShowGameOverOverlay(true); setShowForfeitConfirm(false);
    } catch (e) { console.error(e); }
  }, [authHeaders]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (isGameOver || boardLocked) return false;

    // Identify piece type BEFORE the move (FEN changes after server responds)
    const pieceType = pieceTypeFromFenSquare(preMovePositionRef.current, sourceSquare);

    void (async () => {
      try {
        const h   = await authHeaders();
        const res = await fetch("/api/move", {
          method: "POST", headers: h,
          body: JSON.stringify({ move: sourceSquare + targetSquare }),
        });
        const data = await res.json() as MoveResponse;
        if (data.status === "ok") {
          preMovePositionRef.current = data.fen;
          applyResponse(data);
          clearHighlights();

          // Tell AugmentDraftPopup which piece just moved so it can spend
          // any matching held augment (even if the buff wasn't used).
          if (pieceType) setLastWhiteMovedPieceType(pieceType);

          void fetchAugments();
        } else {
          setStatus(data.message ?? "Illegal move");
        }
      } catch (e) { console.error(e); setStatus("Connection error"); }
    })();
    return true;
  }, [isGameOver, boardLocked, authHeaders, applyResponse, clearHighlights, fetchAugments]);

  // -------------------------
  // Timer logic
  // -------------------------
  const stopTimer = useCallback(() => {
    setTimerRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const startTimer = useCallback((minutes: number) => {
    const seconds = minutes * 60;
    setWhiteTime(seconds); setBlackTime(seconds); setTimerRunning(false);
  }, []);

  const applyTimerMode = useCallback((mode: "none" | "1" | "3" | "5" | "10") => {
    setTimerMode(mode); stopTimer();
    if (mode === "none") { setWhiteTime(0); setBlackTime(0); return; }
    startTimer(Number(mode));
  }, [startTimer, stopTimer]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const resetGameWithTimer = useCallback(async () => {
    await resetGame();
    stopTimer();
    if (timerMode !== "none") startTimer(Number(timerMode));
  }, [resetGame, startTimer, stopTimer, timerMode]);

  // -------------------------
  // Effects
  // -------------------------
  useEffect(() => {
    if (!timerRunning || timerMode === "none" || isGameOver) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      if (currentTurn === "white") {
        setWhiteTime((t) => {
          if (t <= 1) { stopTimer(); setGameOverMessage("Time's up — Black wins!"); setStatus("Time's up — Black wins!"); setIsGameOver(true); setShowGameOverOverlay(true); return 0; }
          return t - 1;
        });
      } else {
        setBlackTime((t) => {
          if (t <= 1) { stopTimer(); setGameOverMessage("Time's up — White wins!"); setStatus("Time's up — White wins!"); setIsGameOver(true); setShowGameOverOverlay(true); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [currentTurn, isGameOver, stopTimer, timerMode, timerRunning]);

  useEffect(() => { if (isGameOver) stopTimer(); }, [isGameOver, stopTimer]);

  useEffect(() => {
    if (timerMode !== "none" && !timerRunning && !isGameOver && moveHistory.length > 0) setTimerRunning(true);
  }, [isGameOver, moveHistory.length, timerMode, timerRunning]);

  // Initial load
  useEffect(() => {
    void (async () => {
      try {
        const h   = await authHeaders();
        const res = await fetch("/api/board", { headers: h });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json() as MoveResponse;
        applyResponse(data);
        preMovePositionRef.current = data.fen;
        setBoardError("");
      } catch { setBoardError("Could not connect to game server."); }
    })();
    void fetchAugments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock board on every 3rd turn for augment draft
  useEffect(() => {
    if (turnCount > 0 && turnCount % 6 === 0) setBoardLocked(true);
  }, [turnCount]);

  // -------------------------
  // Square highlight styles
  // -------------------------
  const customSquareStyles: Record<string, React.CSSProperties> = {};

  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      background: "radial-gradient(circle, rgba(226,201,126,0.55) 0%, rgba(226,201,126,0.15) 70%)",
      boxShadow: "inset 0 0 0 2px rgba(226,201,126,0.7)",
    };
  }

  highlightedSquares.forEach(({ square, is_capture, is_teleport }) => {
    if (is_teleport)      customSquareStyles[square] = { background: "radial-gradient(circle, rgba(236,72,153,0.35) 30%, transparent 70%)", boxShadow: "inset 0 0 0 2px rgba(236,72,153,0.5)" };
    else if (is_capture)  customSquareStyles[square] = { background: "radial-gradient(circle, rgba(239,68,68,0.4) 30%, transparent 70%)", boxShadow: "inset 0 0 0 3px rgba(239,68,68,0.65)" };
    else                  customSquareStyles[square] = { background: "radial-gradient(circle, rgba(74,222,128,0.5) 22%, transparent 26%)" };
  });

  damagedPawns.forEach((sq) => {
    const name = squareIndexToName(sq);
    if (name) customSquareStyles[name] = { ...customSquareStyles[name], boxShadow: "inset 0 0 0 3px rgba(251,146,60,0.85)", backgroundColor: "rgba(251,146,60,0.14)" };
  });

  const blockedStyles: Record<string, React.CSSProperties> = {
    king_guard:                    { boxShadow: "inset 0 0 0 3px rgba(251,191,36,0.8)",  backgroundColor: "rgba(251,191,36,0.1)" },
    second_bishop_move_no_capture: { boxShadow: "inset 0 0 0 3px rgba(139,92,246,0.8)", backgroundColor: "rgba(139,92,246,0.1)" },
    king_in_check:                 { boxShadow: "inset 0 0 0 3px rgba(239,68,68,0.9)",  backgroundColor: "rgba(239,68,68,0.12)" },
    king_stride_no_capture:        { boxShadow: "inset 0 0 0 3px rgba(148,163,184,0.7)",backgroundColor: "rgba(148,163,184,0.08)" },
    pawn_shield:                   { boxShadow: "inset 0 0 0 3px rgba(14,165,233,0.8)", backgroundColor: "rgba(14,165,233,0.1)" },
  };
  blockedSquares.forEach(({ square, reason }) => {
    customSquareStyles[square] = blockedStyles[reason] ?? { boxShadow: "inset 0 0 0 3px rgba(148,163,184,0.6)", backgroundColor: "rgba(148,163,184,0.07)" };
  });

  const isAlert = status.toLowerCase().includes("check") || status.toLowerCase().includes("may move");

  // -------------------------
  // Render
  // -------------------------
  return (
    <>
      <style>{STYLES}</style>
      <div className="chess-page">

        {/* Augment draft popup — owns collection writes, reports changes up */}
        <AugmentDraftPopup
          key={gameResetKey}
          turnCount={turnCount}
          movedPieceType={lastWhiteMovedPieceType}
          onDraftComplete={() => { void fetchAugments(); setBoardLocked(false); }}
          onCollectionChange={setOwnedCollection}
        />

        {/* Header */}
        <div className="chess-header">
          <h1 className="chess-title">♟ Match</h1>
          <p className="chess-subtitle">Turn {turnCount}</p>
        </div>

        {boardError && <div className="error-banner">{boardError}</div>}

        {/* Difficulty */}
        <div className="difficulty-row">
          {(["easy", "medium", "hard"] as const).map((level) => (
            <button key={level} className={`diff-btn${difficulty === level ? " active" : ""}`} onClick={() => void changeDifficulty(level)}>
              {level}
            </button>
          ))}
        </div>

        {/* Main arena */}
        <div className="main-arena">
          <MoveHistoryPanel history={moveHistory} />

          <div className="board-column">
            {/* Top bar */}
            <div className="board-topbar">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div className="turn-indicator">
                  <div className="turn-pip" style={{
                    background: currentTurn === "white" ? "rgba(245,230,178,0.9)" : "rgba(30,41,59,0.9)",
                    border: currentTurn === "white" ? "1px solid rgba(226,201,126,0.6)" : "1px solid rgba(148,163,184,0.3)",
                    boxShadow: currentTurn === "white" ? "0 0 8px rgba(226,201,126,0.5)" : "0 0 8px rgba(99,102,241,0.3)",
                  }} />
                  <span className="turn-label">{currentTurn === "white" ? "White to move" : "Black to move"}</span>
                </div>
                <span className={`status-text${isAlert ? " alert" : ""}`}>{status}</span>
                {(queenTeleportUsed.white || queenTeleportUsed.black) && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    {queenTeleportUsed.white && <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.62rem", color: "#64748b", padding: "2px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>✨ White teleport used</span>}
                    {queenTeleportUsed.black && <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.62rem", color: "#64748b", padding: "2px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>✨ Black teleport used</span>}
                  </div>
                )}
              </div>

              <div className="board-controls">
                {isGameOver && !showGameOverOverlay && <button className="ctrl-btn" onClick={() => setShowGameOverOverlay(true)}>Result</button>}
                {!isGameOver && <button className="ctrl-btn danger" onClick={() => setShowForfeitConfirm(true)}>Forfeit</button>}
                <button className="ctrl-btn" onClick={() => void resetGameWithTimer()}>🔄 Reset</button>
                <button className="ctrl-btn" onClick={() => navigate("/menu")}>← Menu</button>
              </div>
            </div>

            {/* Timer mode selector */}
            <div className="timer-toggle-row">
              {(["none", "1", "3", "5", "10"] as const).map((mode) => (
                <button key={mode} className={`timer-opt-btn ${timerMode === mode ? "selected" : ""}`} onClick={() => applyTimerMode(mode)} type="button">
                  {mode === "none" ? "No Timer" : `${mode} Min`}
                </button>
              ))}
            </div>

            {timerMode !== "none" && (
              <div className="timer-row">
                <div className={`timer-clock ${currentTurn === "white" ? "active-clock" : ""} ${whiteTime <= 30 ? "low-time" : ""}`}>
                  <span className="timer-side-label">White</span>
                  <span className={`timer-digits ${whiteTime <= 30 ? "low" : ""}`}>{formatTime(whiteTime)}</span>
                </div>
                <span className="timer-divider">VS</span>
                <div className={`timer-clock ${currentTurn === "black" ? "active-clock" : ""} ${blackTime <= 30 ? "low-time" : ""}`}>
                  <span className="timer-side-label">Black</span>
                  <span className={`timer-digits ${blackTime <= 30 ? "low" : ""}`}>{formatTime(blackTime)}</span>
                </div>
              </div>
            )}

            {/* Board */}
            <div className="board-wrapper" style={{ width: 480, height: 480 }}>
              <Chessboard
                boardWidth={480}
                position={position}
                onPieceDrop={onDrop}
                onSquareClick={(sq) => void fetchLegalMoves(sq)}
                onPieceDragBegin={(_p, sq) => void fetchLegalMoves(sq)}
                customSquareStyles={customSquareStyles}
                customBoardStyle={{ borderRadius: "0px" }}
                customDarkSquareStyle={{ backgroundColor: "#2d4a3e" }}
                customLightSquareStyle={{ backgroundColor: "#8fbc8f" }}
                id="main-board"
              />

              {boardLocked && !isGameOver && (
                <div className="board-lock-dim">
                  <span className="board-lock-label">⚔ Augment Draft</span>
                </div>
              )}

              {isGameOver && showGameOverOverlay && (
                <div className="board-overlay overlay-gameover">
                  <div className="overlay-title">{gameOverMessage}</div>
                  <div className="overlay-sub">The game has ended.</div>
                  <div className="overlay-actions">
                    <button className="overlay-btn" onClick={() => void resetGameWithTimer()}>Play Again</button>
                    <button className="overlay-btn ghost" onClick={() => setShowGameOverOverlay(false)}>View Board</button>
                    <button className="overlay-btn ghost" onClick={() => navigate("/menu")}>Menu</button>
                  </div>
                </div>
              )}

              {showForfeitConfirm && (
                <div className="board-overlay overlay-forfeit">
                  <div className="overlay-title" style={{ fontSize: "1.5rem" }}>Forfeit Match?</div>
                  <div className="overlay-sub danger">This will be recorded as a loss.</div>
                  <div className="overlay-actions">
                    <button className="overlay-btn red" onClick={() => void handleForfeit()}>Forfeit</button>
                    <button className="overlay-btn ghost" onClick={() => setShowForfeitConfirm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="legend">
              {[
                { color: "rgba(226,201,126,0.7)", label: "Selected" },
                { color: "rgba(74,222,128,0.7)",  label: "Legal move" },
                { color: "rgba(239,68,68,0.7)",   label: "Capture" },
                { color: "rgba(251,146,60,0.7)",  label: "Damaged pawn" },
                { color: "rgba(251,191,36,0.7)",  label: "King guard" },
                { color: "rgba(14,165,233,0.7)",  label: "Pawn shield" },
                { color: "rgba(236,72,153,0.7)",  label: "Teleport" },
              ].map(({ color, label }) => (
                <div key={label} className="legend-item">
                  <div className="legend-dot" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Augment panel — reads collection, dev toggles */}
          <AugmentPanel
            activeAugments={activeAugments}
            ownedCollection={ownedCollection}
            onToggleAugment={toggleAugment}
            devMode={true}
          />
        </div>
      </div>
    </>
  );
}