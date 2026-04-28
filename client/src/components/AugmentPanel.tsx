import { useState } from "react";

type AugmentMap = Record<string, boolean>;
type SideAugments = { white: AugmentMap; black: AugmentMap };

type AugmentPanelProps = {
  activeAugments: SideAugments;
  onToggleAugment?: (side: "white" | "black", augmentName: string) => void;
  devMode?: boolean;
};

const AUGMENT_LABELS: Record<string, string> = {
  // Pawn
  pawn_two_hits:        "Pawn: 2 Hits to Remove",
  pawn_explosion:       "Pawn: Explosion on Capture",
  pawn_double_push:     "Pawn: Always Double Push",
  // Knight
  knight_long_jump:                   "Knight: 4×1 Long Jump",
  knight_second_move_after_capture:   "Knight: Move Again After Capture",
  // Bishop
  bishop_phase:       "Bishop: Phase Through One Piece",
  bishop_double_move: "Bishop: Double Move",
  // Rook
  rook_triple_move_bonus: "Rook: 3+ Squares → Bonus Move",
  rook_pawn_shield:       "Rook: Pawn Shield",
  // Queen
  queen_teleport:    "Queen: Teleport (Once)",
  queen_pawn_shield: "Queen: Pawn Shield",
  // King
  king_guard:  "King: Guard Zone",
  king_stride: "King: Stride (2 Squares)",
};

// Group keys by piece for display
const AUGMENT_GROUPS = [
  { label: "Pawn",   keys: ["pawn_two_hits", "pawn_explosion", "pawn_double_push"] },
  { label: "Knight", keys: ["knight_long_jump", "knight_second_move_after_capture"] },
  { label: "Bishop", keys: ["bishop_phase", "bishop_double_move"] },
  { label: "Rook",   keys: ["rook_triple_move_bonus", "rook_pawn_shield"] },
  { label: "Queen",  keys: ["queen_teleport", "queen_pawn_shield"] },
  { label: "King",   keys: ["king_guard", "king_stride"] },
];

export default function AugmentPanel({
  activeAugments,
  onToggleAugment,
  devMode = false,
}: AugmentPanelProps) {
  const [showDevControls, setShowDevControls] = useState(false);

  const renderEnabledList = (side: "white" | "black") => {
    const enabled = Object.entries(activeAugments[side] || {})
      .filter(([, on]) => on)
      .map(([key]) => AUGMENT_LABELS[key] || key);

    if (enabled.length === 0) {
      return <p style={{ marginTop: "0.25rem", color: "#64748b", fontSize: "0.82rem" }}>None active.</p>;
    }

    return (
      <ul style={{ marginTop: "0.25rem", paddingLeft: "1.1rem" }}>
        {enabled.map((label) => (
          <li key={label} style={{ marginBottom: "0.3rem", fontSize: "0.82rem", color: "#e2e8f0" }}>
            {label}
          </li>
        ))}
      </ul>
    );
  };

  const renderDevControls = (side: "white" | "black") => (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {AUGMENT_GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: "8px" }}>
          <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: "700", letterSpacing: "0.06em", marginBottom: "4px", textTransform: "uppercase" }}>
            {group.label}
          </div>
          {group.keys.map((key) => {
            const enabled = activeAugments[side]?.[key] ?? false;
            return (
              <label
                key={key}
                style={{ display: "flex", alignItems: "center", gap: "7px", cursor: "pointer", lineHeight: "1.4", marginBottom: "2px" }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => onToggleAugment?.(side, key)}
                  style={{ accentColor: "#6366f1" }}
                />
                <span style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>{AUGMENT_LABELS[key] || key}</span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      minWidth: "300px", maxWidth: "360px",
      background: "#1a2236",
      padding: "14px 16px",
      borderRadius: "14px",
      color: "white",
      textAlign: "left",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <h3 style={{ marginTop: 0, marginBottom: "12px", fontSize: "0.95rem", color: "#a5b4fc" }}>
        Active Augments
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <h4 style={{ marginBottom: "0.4rem", color: "#f8fafc", fontSize: "0.85rem" }}>⬜ White</h4>
          {renderEnabledList("white")}
        </div>
        <div>
          <h4 style={{ marginBottom: "0.4rem", color: "#f8fafc", fontSize: "0.85rem" }}>⬛ Black</h4>
          {renderEnabledList("black")}
        </div>
      </div>

      {devMode && (
        <>
          <button
            onClick={() => setShowDevControls(!showDevControls)}
            style={{
              marginTop: "12px", padding: "7px 12px", borderRadius: "8px",
              border: "1px solid rgba(99,102,241,0.4)", cursor: "pointer",
              fontWeight: "bold", fontSize: "0.82rem",
              background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
              width: "100%",
            }}
          >
            {showDevControls ? "▲ Hide Dev Controls" : "▼ Show Dev Controls"}
          </button>

          {showDevControls && (
            <>
              <hr style={{ margin: "12px 0", borderColor: "#2d3f60" }} />
              <h3 style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "#94a3b8" }}>Dev Controls</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>
                <div>
                  <h4 style={{ marginBottom: "6px", color: "#f8fafc", fontSize: "0.82rem" }}>⬜ White</h4>
                  {renderDevControls("white")}
                </div>
                <div>
                  <h4 style={{ marginBottom: "6px", color: "#f8fafc", fontSize: "0.82rem" }}>⬛ Black</h4>
                  {renderDevControls("black")}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}