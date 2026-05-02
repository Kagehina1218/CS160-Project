import { useEffect, useRef, useState } from "react";

// ─── Augment definitions ──────────────────────────────────────────────────────

export const AUGMENTS = [
  // ── Pawn ──────────────────────────────────────────────────────────────────
  {
    key: "pawn_two_hits",
    label: "Pawn: Two Hits to Remove",
    description: "Your pawns require 2 captures to be removed from the board",
    pieceType: "pawn" as PieceType,
  },
  {
    key: "pawn_explosion",
    label: "Pawn: Explosion on Capture",
    description: "When your pawn captures, it explodes — removing all adjacent pieces",
    pieceType: "pawn" as PieceType,
  },
  {
    key: "pawn_double_push",
    label: "Pawn: Always Double Push",
    description: "Your pawns can always push 2 squares forward, regardless of rank",
    pieceType: "pawn" as PieceType,
  },
  // ── Knight ────────────────────────────────────────────────────────────────
  {
    key: "knight_long_jump",
    label: "Knight: 4×1 Jump",
    description: "Move your knight in a 4+1 L-shape instead of 2+1",
    pieceType: "knight" as PieceType,
  },
  {
    key: "knight_second_move_after_capture",
    label: "Knight: Move Again After Capture",
    description: "After a knight captures, move it a second time",
    pieceType: "knight" as PieceType,
  },
  // ── Bishop ────────────────────────────────────────────────────────────────
  {
    key: "bishop_phase",
    label: "Bishop: Phase Through One Piece",
    description: "Your bishop can pass through exactly one blocking piece",
    pieceType: "bishop" as PieceType,
  },
  {
    key: "bishop_double_move",
    label: "Bishop: Double Move",
    description: "After a non-capturing bishop move, move it again",
    pieceType: "bishop" as PieceType,
  },
  // ── Rook ──────────────────────────────────────────────────────────────────
  {
    key: "rook_triple_move_bonus",
    label: "Rook: Long Move Bonus",
    description: "Moving your rook 3+ squares grants it a free bonus move",
    pieceType: "rook" as PieceType,
  },
  {
    key: "rook_pawn_shield",
    label: "Rook: Pawn Shield",
    description: "Enemy pawns cannot capture your rook",
    pieceType: "rook" as PieceType,
  },
  // ── Queen ─────────────────────────────────────────────────────────────────
  {
    key: "queen_teleport",
    label: "Queen: Teleport",
    description: "Once per game, teleport your queen to any empty square",
    pieceType: "queen" as PieceType,
  },
  {
    key: "queen_pawn_shield",
    label: "Queen: Pawn Shield",
    description: "Enemy pawns cannot capture your queen",
    pieceType: "queen" as PieceType,
  },
  // ── King ──────────────────────────────────────────────────────────────────
  {
    key: "king_stride",
    label: "King: Stride",
    description: "Your king can move up to 2 squares in any direction",
    pieceType: "king" as PieceType,
  },
  {
    key: "king_guard",
    label: "King: Guard Zone",
    description: "The 4 squares orthogonally adjacent to your king are blocked to the opponent",
    pieceType: "king" as PieceType,
  },
] as const;

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export type AugmentKey = (typeof AUGMENTS)[number]["key"];
export type Augment = (typeof AUGMENTS)[number];

/**
 * One entry in the player's owned collection.
 *
 * State machine:  drafted → active=true, spent=false
 *                 piece moves → active=false, spent=true
 */
export type OwnedAugment = {
  key: AugmentKey;
  pieceType: PieceType;
  label: string;
  description: string;
  /** True while waiting for the piece to move (buff is live on the backend). */
  active: boolean;
  /** True once the piece moved and the buff was consumed. */
  spent: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiEnableAugment(key: string) {
  // Clear existing active white augments first (only one active at a time)
  const res = await fetch("/api/augments");
  const data = await res.json();
  const currentWhite: Record<string, boolean> = data.active_augments?.white ?? {};
  async function apiEnableAugment(key: string) {
    await fetch("/api/augments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side: "white", augment: key }),
    });
  }
  await fetch("/api/augments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ side: "white", augment: key }),
  });
}

async function apiDisableAugment(key: string) {
  await fetch("/api/augments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ side: "white", augment: key }),
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type AugmentDraftPopupProps = {
  turnCount: number;
  /**
   * Piece type of the most recent white move. Parent updates this after every
   * successful white move. The component only reacts to value *changes*.
   */
  movedPieceType?: PieceType | null;
  /** Called when draft popup closes — parent should unlock the board. */
  onDraftComplete: () => void;
  /**
   * Called whenever the owned collection changes.
   * Parent passes this down to AugmentPanel for display.
   */
  onCollectionChange?: (collection: OwnedAugment[]) => void;
};

// ─── Main component ───────────────────────────────────────────────────────────
//
// LIFECYCLE
// ─────────
// • Every 3 turns: popup opens showing 3 augments from the available pool.
//   Pool excludes augments already owned (held or spent) AND any pieceType
//   that already has an active (held) augment → exclusion rule.
//
// • On Confirm: augment is added to ownedCollection (active=true, spent=false)
//   and immediately enabled on the backend. Board unlocks. The buff is live.
//
// • On piece move (movedPieceType changes): the active augment matching that
//   pieceType is marked spent, and disabled on the backend — whether or not
//   the player used the buff.
//
// • The full collection (held + spent) is surfaced to the parent via
//   onCollectionChange so AugmentPanel can display an overview.

export default function AugmentDraftPopup({
  turnCount,
  movedPieceType,
  onDraftComplete,
  onCollectionChange,
}: AugmentDraftPopupProps) {
  const [ownedCollection, setOwnedCollection] = useState<OwnedAugment[]>([]);

  const [isOpen, setIsOpen]         = useState(false);
  const [minimized, setMinimized]   = useState(false);
  const [options, setOptions]       = useState<Augment[]>([]);
  const [selected, setSelected]     = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Helper: update state and notify parent in one go
  const updateCollection = (next: OwnedAugment[]) => {
    setOwnedCollection(next);
    onCollectionChange?.(next);
  };

  // ── Spend active augment when associated piece moves ──────────────────────
  const prevMovedRef = useRef<PieceType | null | undefined>(undefined);
  useEffect(() => {
    if (!movedPieceType || movedPieceType === prevMovedRef.current) return;
    prevMovedRef.current = movedPieceType;

    setOwnedCollection((prev) => {
      const idx = prev.findIndex(
        (a) => a.pieceType === movedPieceType && a.active && !a.spent
      );
      if (idx === -1) return prev;

      apiDisableAugment(prev[idx].key).catch(console.error);

      const next = prev.map((a, i) =>
        i === idx ? { ...a, active: false, spent: true } : a
      );
      onCollectionChange?.(next);
      return next;
    });
  }, [movedPieceType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open draft every 3 turns ──────────────────────────────────────────────
  useEffect(() => {
    if (turnCount <= 0 || turnCount % 6 !== 0) return;

    // Read current collection synchronously via functional update pattern
    setOwnedCollection((prev) => {
      const ownedKeys      = new Set(prev.map((a) => a.key));
      const heldPieceTypes = new Set(
        prev.filter((a) => a.active && !a.spent).map((a) => a.pieceType)
      );

      const available = AUGMENTS.filter(
        (a) => !ownedKeys.has(a.key) && !heldPieceTypes.has(a.pieceType)
      );

      if (available.length === 0) return prev; // nothing to offer

      setOptions(pickRandom(available, Math.min(3, available.length)));
      setSelected(null);
      setMinimized(false);
      setIsOpen(true);

      return prev; // collection itself doesn't change here
    });
  }, [turnCount]);

  // ── Confirm pick ──────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selected) return;
    const aug = AUGMENTS.find((a) => a.key === selected);
    if (!aug) return;

    setConfirming(true);
    try {
      await apiEnableAugment(selected);

      const newEntry: OwnedAugment = {
        key: aug.key as AugmentKey,
        pieceType: aug.pieceType,
        label: aug.label,
        description: aug.description,
        active: true,
        spent: false,
      };

      setOwnedCollection((prev) => {
        const next = [...prev, newEntry];
        onCollectionChange?.(next);
        return next;
      });

      setIsOpen(false);
      setMinimized(false);
      onDraftComplete();
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Board lock overlay */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 998, pointerEvents: "all",
          background: minimized ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.18)",
          transition: "background 0.25s", cursor: "not-allowed",
        }}
      />

      {/* Minimized pill */}
      {minimized && (
        <button
          onClick={() => setMinimized(false)}
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 1001,
            display: "flex", alignItems: "center", gap: 8,
            background: "#534AB7", border: "none", borderRadius: 24,
            padding: "9px 16px", cursor: "pointer",
            animation: "aug-pulse-shadow 2s infinite",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#CECBF6", flexShrink: 0, display: "inline-block", animation: "aug-dot-pulse 1.5s infinite" }} />
          <span style={{ fontSize: 13, color: "white", fontWeight: 500 }}>Pick your augment</span>
          <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "white", padding: "2px 8px", borderRadius: 8 }}>
            Turn {turnCount}
          </span>
        </button>
      )}

      {/* Full popup */}
      {!minimized && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, pointerEvents: "none" }}>
          <div style={{ background: "#1f2a44", borderRadius: 16, padding: "1.5rem", width: 460, color: "white", boxShadow: "0 8px 48px rgba(0,0,0,0.55)", pointerEvents: "all" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Choose an augment</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, background: "#CECBF6", color: "#3C3489", padding: "3px 10px", borderRadius: 8, fontWeight: 500 }}>
                  Turn {turnCount}
                </span>
                <button
                  onClick={() => setMinimized(true)}
                  style={{ background: "transparent", border: "0.5px solid #3a4a6a", borderRadius: 6, color: "#7a8aaa", fontSize: 12, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, lineHeight: 1, whiteSpace: "nowrap" }}
                >
                  <span style={{ fontSize: 14 }}>⊙</span> Inspect board
                </button>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#aaa", marginBottom: "1.25rem", lineHeight: 1.5 }}>
              Augments are added to your collection and activate immediately. The buff is <strong style={{ color: "#c8c0f8" }}>spent the first time you move that piece</strong> — even if you don't use the buff.
            </p>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
              {options.map((aug) => (
                <DraftOption
                  key={aug.key}
                  aug={aug}
                  selected={selected === aug.key}
                  onClick={() => setSelected(selected === aug.key ? null : aug.key)}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "0.5px solid #3a4a6a" }}>
              <span style={{ fontSize: 12, color: "#7a8aaa" }}>
                {selected
                  ? `Selected: ${options.find((a) => a.key === selected)?.label}`
                  : "Choose one to unlock the board"}
              </span>
              <button
                onClick={handleConfirm}
                disabled={!selected || confirming}
                style={{
                  padding: "8px 22px", borderRadius: 8, border: "none",
                  background: selected ? "#534AB7" : "#3a4a6a",
                  color: "white", fontSize: 14, fontWeight: 500,
                  cursor: selected && !confirming ? "pointer" : "not-allowed",
                  opacity: selected ? 1 : 0.5, transition: "background 0.15s",
                }}
              >
                {confirming ? "Applying…" : "Add to collection"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes aug-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes aug-pulse-shadow {
          0%, 100% { box-shadow: 0 4px 18px rgba(83,74,183,0.45); }
          50%       { box-shadow: 0 4px 28px rgba(83,74,183,0.8); }
        }
      `}</style>
    </>
  );
}

// ─── DraftOption ──────────────────────────────────────────────────────────────

const PIECE_EMOJI: Record<PieceType, string> = {
  pawn: "♟", knight: "♞", bishop: "♝", rook: "♜", queen: "♛", king: "♚",
};
const PIECE_COLOR: Record<PieceType, string> = {
  pawn: "#fb923c", knight: "#6ee7b7", bishop: "#93c5fd",
  rook: "#c084fc", queen: "#f472b6", king: "#fde68a",
};

function DraftOption({ aug, selected, onClick }: { aug: Augment; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px", borderRadius: 8, cursor: "pointer",
        border: selected ? `2px solid ${PIECE_COLOR[aug.pieceType]}` : "0.5px solid #3a4a6a",
        background: selected ? "rgba(45,32,96,0.9)" : "#2a3553",
        transition: "all 0.15s",
        display: "flex", alignItems: "flex-start", gap: 10,
      }}
    >
      {/* Piece emoji badge */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: selected ? `${PIECE_COLOR[aug.pieceType]}22` : "rgba(255,255,255,0.05)",
        border: `1px solid ${selected ? PIECE_COLOR[aug.pieceType] + "55" : "#3a4a6a"}`,
        fontSize: 18, transition: "all 0.15s",
      }}>
        {PIECE_EMOJI[aug.pieceType]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: selected ? "#c8c0f8" : "white", fontWeight: 500, marginBottom: 2 }}>
          {aug.label}
        </div>
        <div style={{ fontSize: 12, color: "#7a8aaa", lineHeight: 1.4 }}>
          {aug.description}
        </div>
        <div style={{ marginTop: 4 }}>
          <span style={{
            fontSize: 11, padding: "1px 7px", borderRadius: 6,
            background: `${PIECE_COLOR[aug.pieceType]}18`,
            color: PIECE_COLOR[aug.pieceType], border: `0.5px solid ${PIECE_COLOR[aug.pieceType]}44`,
            textTransform: "capitalize",
          }}>
            {aug.pieceType}
          </span>
        </div>
      </div>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 6,
        background: selected ? PIECE_COLOR[aug.pieceType] : "#4a5a7a",
        transition: "background 0.15s",
      }} />
    </div>
  );
}