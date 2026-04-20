import { useState } from "react";

type AugmentMap = Record<string, boolean>;

type SideAugments = {
  white: AugmentMap;
  black: AugmentMap;
};

type AugmentPanelProps = {
  activeAugments: SideAugments;
  onToggleAugment?: (side: "white" | "black", augmentName: string) => void;
  devMode?: boolean;
};

export default function AugmentPanel({
  activeAugments,
  onToggleAugment,
  devMode = false,
}: AugmentPanelProps) {
  const [showDevControls, setShowDevControls] = useState(false);
  const activeAugmentLabels: Record<string, string> = {
    knight_long_jump: "Knight: 4x1 Jump",
    knight_second_move_after_capture: "Knight: Move Again After Capture",
    bishop_phase: "Bishop: Move Through One Piece",
    bishop_double_move: "Bishop: Double Move",
    king_guard: "King: Adjacent Ally Protection",
    king_bodyguard: "King: Protected By Nearby Ally",
    random_mutation: "Random Mid-Game Mutation",
  };

  const renderEnabledList = (side: "white" | "black") => {
    const enabledAugments = Object.entries(activeAugments[side] || {})
      .filter(([_, enabled]) => enabled)
      .map(([key]) => activeAugmentLabels[key] || key);

    if (enabledAugments.length === 0) {
      return <p style={{ marginTop: "0.25rem" }}>No augments active.</p>;
    }

    return (
      <ul style={{ marginTop: "0.25rem", paddingLeft: "1.2rem" }}>
        {enabledAugments.map((augment) => (
          <li key={`${side}-${augment}`} style={{ marginBottom: "0.35rem" }}>
            {augment}
          </li>
        ))}
      </ul>
    );
  };

  const renderDevControls = (side: "white" | "black") => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Object.entries(activeAugments[side] || {}).map(([key, enabled]) => (
          <label
            key={`${side}-${key}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              lineHeight: "1.3",
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => onToggleAugment?.(side, key)}
            />
            <span>{activeAugmentLabels[key] || key}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        minWidth: "320px",
        maxWidth: "380px",
        background: "#1f2a44",
        padding: "1rem",
        borderRadius: "12px",
        color: "white",
        textAlign: "left",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Active Augments</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
        }}
      >
        <div>
          <h4 style={{ marginBottom: "0.5rem" }}>White</h4>
          {renderEnabledList("white")}
        </div>

        <div>
          <h4 style={{ marginBottom: "0.5rem" }}>Black</h4>
          {renderEnabledList("black")}
        </div>
      </div>

      {devMode && (
        <>
          <button
            onClick={() => setShowDevControls(!showDevControls)}
            style={{
              marginTop: "1rem",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {showDevControls ? "Hide Dev Controls" : "Show Dev Controls"}
          </button>

          {showDevControls && (
            <>
              <hr style={{ margin: "1rem 0", borderColor: "#4a5a7a" }} />
              <h3>Dev Mode</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  alignItems: "start",
                }}
              >
                <div>
                  <h4 style={{ marginBottom: "0.5rem" }}>White</h4>
                  {renderDevControls("white")}
                </div>

                <div>
                  <h4 style={{ marginBottom: "0.5rem" }}>Black</h4>
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