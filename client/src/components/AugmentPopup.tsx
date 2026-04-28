import { useEffect, useRef, useState } from "react";

// ─── Augment definitions ──────────────────────────────────────────────────────

const AUGMENTS = [
  {
    key: "knight_long_jump",
    label: "Knight: 4×1 jump",
    description: "Move your knight in a 4+1 L-shape instead of 2+1",
  },
  {
    key: "knight_second_move_after_capture",
    label: "Knight: move again after capture",
    description: "After a knight captures, move it a second time",
  },
  {
    key: "bishop_phase",
    label: "Bishop: phase through one piece",
    description: "Your bishop can pass through exactly one blocking piece",
  },
  {
    key: "bishop_double_move",
    label: "Bishop: double move",
    description: "After a non-capturing bishop move, move it again",
  },
  {
    key: "king_stride",
    label: "King: stride",
    description: "Your king can move up to 2 squares in any direction",
  },
  {
    key: "king_guard",
    label: "King: guard zone",
    description:
      "The 4 squares orthogonally adjacent to your king are blocked to the opponent",
  },
];

type Augment = { key: string; label: string; description: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function enableAugment(key: string) {
  const res = await fetch("/api/augments");
  const data = await res.json();
  const currentWhite: Record<string, boolean> =
    data.active_augments?.white ?? {};

  // Disable any currently active white augments
  for (const [aug, isOn] of Object.entries(currentWhite)) {
    if (isOn) {
      await fetch("/api/augments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: "white", augment: aug }),
      });
    }
  }

  // Enable the chosen one
  await fetch("/api/augments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ side: "white", augment: key }),
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  turnCount: number;
  onDraftComplete: () => void;
};

// ─── Main component ───────────────────────────────────────────────────────────
//
// Board lock flow:
//   1. Popup opens → board locked (overlay blocks all clicks)
//   2. Player selects an option → Confirm button enables (board still locked)
//   3. Player clicks Confirm → API call, popup closes, board unlocks
//   4. The augment only affects its associated piece type; all others move normally.
//
// Minimize: collapses to a pill so the player can inspect the board visually.
// The lock overlay stays until Confirm is clicked.

export default function AugmentDraftPopup({ turnCount, onDraftComplete }: Props) {
  const availableRef = useRef<Augment[]>([...AUGMENTS]);

  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [options, setOptions] = useState<Augment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Open draft every 3 turns
  useEffect(() => {
    if (turnCount > 0 && turnCount % 3 === 0) {
      const dealt = pickRandom(availableRef.current, Math.min(3, availableRef.current.length));
      setOptions(dealt);
      setSelected(null);
      setMinimized(false);
      setIsOpen(true);
    }
  }, [turnCount]);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      await enableAugment(selected);
      // Remove picked augment from future rounds
      availableRef.current = availableRef.current.filter((a) => a.key !== selected);
      // Close popup → board unlocks
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
      {/*
       * Board lock overlay — always present while popup is open, even when minimized.
       * Removed only when Confirm is clicked and setIsOpen(false) fires.
       */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 998,
          pointerEvents: "all",
          background: minimized ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)",
          transition: "background 0.25s",
          cursor: "not-allowed",
        }}
      />

      {/* ── Minimized pill ── */}
      {minimized && (
        <button
          onClick={() => setMinimized(false)}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#534AB7",
            border: "none",
            borderRadius: 24,
            padding: "9px 16px",
            cursor: "pointer",
            animation: "aug-pulse-shadow 2s infinite",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#CECBF6",
              flexShrink: 0,
              display: "inline-block",
              animation: "aug-dot-pulse 1.5s infinite",
            }}
          />
          <span style={{ fontSize: 13, color: "white", fontWeight: 500 }}>
            Pick your augment
          </span>
          <span
            style={{
              fontSize: 11,
              background: "rgba(255,255,255,0.15)",
              color: "white",
              padding: "2px 8px",
              borderRadius: 8,
            }}
          >
            Turn {turnCount}
          </span>
        </button>
      )}

      {/* ── Full popup ── */}
      {!minimized && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            pointerEvents: "none", // backdrop passes clicks down to lock overlay
          }}
        >
          <div
            style={{
              background: "#1f2a44",
              borderRadius: 16,
              padding: "1.5rem",
              width: 440,
              color: "white",
              boxShadow: "0 8px 48px rgba(0,0,0,0.55)",
              pointerEvents: "all",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>
                Pick your augment
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    background: "#CECBF6",
                    color: "#3C3489",
                    padding: "3px 10px",
                    borderRadius: 8,
                    fontWeight: 500,
                  }}
                >
                  Turn {turnCount}
                </span>
                <button
                  onClick={() => setMinimized(true)}
                  title="Minimize to inspect the board"
                  style={{
                    background: "transparent",
                    border: "0.5px solid #3a4a6a",
                    borderRadius: 6,
                    color: "#7a8aaa",
                    fontSize: 12,
                    padding: "3px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: 14 }}></span> Inspect board
                </button>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#aaa", marginBottom: "1.25rem" }}>
              Select an augment to unlock the board. Once picked, it won't appear again.
            </p>

            {/* Options — flat list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1.25rem" }}>
              {options.map((aug) => (
                <AugmentOption
                  key={aug.key}
                  aug={aug}
                  selected={selected === aug.key}
                  onClick={() => setSelected(selected === aug.key ? null : aug.key)}
                />
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "1rem",
                borderTop: "0.5px solid #3a4a6a",
              }}
            >
              <span style={{ fontSize: 12, color: "#7a8aaa" }}>
                {selected
                  ? `Selected: ${options.find((a) => a.key === selected)?.label}`
                  : "Choose one to unlock the board"}
              </span>
              <button
                onClick={handleConfirm}
                disabled={!selected || confirming}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: selected ? "#534AB7" : "#3a4a6a",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: selected && !confirming ? "pointer" : "not-allowed",
                  opacity: selected ? 1 : 0.5,
                  transition: "background 0.15s",
                }}
              >
                {confirming ? "Applying…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes aug-dot-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        @keyframes aug-pulse-shadow {
          0%, 100% { box-shadow: 0 4px 18px rgba(83,74,183,0.45); }
          50%       { box-shadow: 0 4px 28px rgba(83,74,183,0.8); }
        }
      `}</style>
    </>
  );
}

// ─── AugmentOption ────────────────────────────────────────────────────────────

type AugmentOptionProps = {
  aug: Augment;
  selected: boolean;
  onClick: () => void;
};

function AugmentOption({ aug, selected, onClick }: AugmentOptionProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        cursor: "pointer",
        border: selected ? "2px solid #534AB7" : "0.5px solid #3a4a6a",
        background: selected ? "#2d2060" : "#2a3553",
        transition: "border-color 0.15s, background 0.15s",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          marginTop: 5,
          background: selected ? "#534AB7" : "#4a5a7a",
          transition: "background 0.15s",
        }}
      />
      <div>
        <div
          style={{
            fontSize: 14,
            color: selected ? "#c8c0f8" : "white",
            transition: "color 0.15s",
          }}
        >
          {aug.label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#7a8aaa",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {aug.description}
        </div>
      </div>
    </div>
  );
}