import { useState } from "react";
import type { OwnedAugment, PieceType } from "./AugmentPopup";

// ─── Types ────────────────────────────────────────────────────────────────────

type AugmentMap = Record<string, boolean>;
type SideAugments = { white: AugmentMap; black: AugmentMap };

type AugmentPanelProps = {
  activeAugments: SideAugments;
  /** Full owned collection from AugmentDraftPopup (held + spent). */
  ownedCollection?: OwnedAugment[];
  onToggleAugment?: (side: "white" | "black", augmentName: string) => void;
  devMode?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PIECE_EMOJI: Record<PieceType, string> = {
  pawn: "♟", knight: "♞", bishop: "♝", rook: "♜", queen: "♛", king: "♚",
};
const PIECE_COLOR: Record<PieceType, string> = {
  pawn: "#fb923c", knight: "#6ee7b7", bishop: "#93c5fd",
  rook: "#c084fc", queen: "#f472b6", king: "#fde68a",
};

/**
 * All draftable augments grouped for the Dev panel.
 * Mirrors AUGMENTS in AugmentDraftPopup exactly — every augment is now
 * draftable, so there is no separate "dev-only" list.
 */
const ALL_AUGMENTS_BY_GROUP: { key: string; label: string; group: string }[] = [
  { key: "pawn_two_hits",                    label: "Pawn: Two Hits to Remove",         group: "Pawn"   },
  { key: "pawn_explosion",                   label: "Pawn: Explosion on Capture",       group: "Pawn"   },
  { key: "pawn_double_push",                 label: "Pawn: Always Double Push",         group: "Pawn"   },
  { key: "knight_long_jump",                 label: "Knight: 4×1 Jump",                group: "Knight" },
  { key: "knight_second_move_after_capture", label: "Knight: Move Again After Capture", group: "Knight" },
  { key: "bishop_phase",                     label: "Bishop: Phase Through One Piece",  group: "Bishop" },
  { key: "bishop_double_move",               label: "Bishop: Double Move",              group: "Bishop" },
  { key: "rook_triple_move_bonus",           label: "Rook: Long Move Bonus",            group: "Rook"   },
  { key: "rook_pawn_shield",                 label: "Rook: Pawn Shield",                group: "Rook"   },
  { key: "queen_teleport",                   label: "Queen: Teleport",                  group: "Queen"  },
  { key: "queen_pawn_shield",                label: "Queen: Pawn Shield",               group: "Queen"  },
  { key: "king_stride",                      label: "King: Stride (2 Squares)",         group: "King"   },
  { key: "king_guard",                       label: "King: Guard Zone",                 group: "King"   },
];

const DEV_GROUPS = ["Pawn", "Knight", "Bishop", "Rook", "Queen", "King"] as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  width: 280,
  flexShrink: 0,
  background: "#111827",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  color: "white",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AugmentPanel({
  activeAugments,
  ownedCollection = [],
  onToggleAugment,
  devMode = false,
}: AugmentPanelProps) {
  const [tab, setTab]                   = useState<"overview" | "dev">("overview");
  const [showDevControls, setShowDevControls] = useState(false);

  const held  = ownedCollection.filter((a) => a.active && !a.spent);
  const spent = ownedCollection.filter((a) => a.spent);

  // Black active augments (always shown in overview)
  const blackActive = Object.entries(activeAugments.black || {})
    .filter(([, on]) => on)
    .map(([key]) => key);

  return (
    <div style={panel}>
      {/* ── Tab bar ── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {(["overview", ...(devMode ? ["dev"] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as typeof tab)}
            style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              background: tab === t ? "#1f2a44" : "transparent",
              color: tab === t ? "#a5b4fc" : "#475569",
              fontSize: "0.75rem", fontFamily: "inherit",
              borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
              textTransform: "capitalize", fontWeight: tab === t ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {t === "overview" ? "Collection" : "Dev"}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "overview" && (
        <div style={{ padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

          {/* White held augments */}
          <Section title="⬜ Held (White)" accent="#a5b4fc">
            {held.length === 0 ? (
              <EmptyNote>No augments held.</EmptyNote>
            ) : (
              held.map((a) => <AugmentCard key={a.key} aug={a} />)
            )}
          </Section>

          {/* Spent augments (history) */}
          {spent.length > 0 && (
            <Section title="History" accent="#475569">
              {spent.map((a) => <AugmentCard key={a.key} aug={a} dimmed />)}
            </Section>
          )}

          {/* Black active augments */}
          <Section title="⬛ Active (Black)" accent="#94a3b8">
            {blackActive.length === 0 ? (
              <EmptyNote>None active.</EmptyNote>
            ) : (
              blackActive.map((key) => (
                <div key={key} style={{ fontSize: "0.8rem", color: "#94a3b8", padding: "4px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                  {key.replace(/_/g, " ")}
                </div>
              ))
            )}
          </Section>
        </div>
      )}

      {/* ── Dev tab ── */}
      {tab === "dev" && devMode && (
        <div style={{ padding: "14px", overflowY: "auto" }}>
          <p style={{ fontSize: "0.72rem", color: "#475569", marginTop: 0, marginBottom: 12 }}>
            Directly toggle augments for testing. Changes bypass the draft system.
          </p>

          <p style={{ fontSize: "0.68rem", color: "#334155", margin: "0 0 8px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>White</p>
          {DEV_GROUPS.map((grp) => {
            const items = ALL_AUGMENTS_BY_GROUP.filter((a) => a.group === grp);
            return (
              <DevGroup key={grp} label={grp}>
                {items.map((a) => (
                  <DevToggle key={a.key} label={a.label} side="white" augKey={a.key} activeAugments={activeAugments} onToggle={onToggleAugment} />
                ))}
              </DevGroup>
            );
          })}

          <hr style={{ margin: "12px 0", borderColor: "#1f2d40" }} />
          <p style={{ fontSize: "0.68rem", color: "#334155", margin: "0 0 8px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Black</p>
          {DEV_GROUPS.map((grp) => {
            const items = ALL_AUGMENTS_BY_GROUP.filter((a) => a.group === grp);
            return (
              <DevGroup key={grp} label={grp}>
                {items.map((a) => (
                  <DevToggle key={a.key} label={a.label} side="black" augKey={a.key} activeAugments={activeAugments} onToggle={onToggleAugment} />
                ))}
              </DevGroup>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", color: accent, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, color: "#334155", fontSize: "0.8rem", fontStyle: "italic" }}>{children}</p>;
}

function AugmentCard({ aug, dimmed = false }: { aug: OwnedAugment; dimmed?: boolean }) {
  const color = PIECE_COLOR[aug.pieceType];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 9,
      padding: "8px 10px", borderRadius: 8, marginBottom: 5,
      background: dimmed ? "rgba(255,255,255,0.02)" : `${color}0d`,
      border: `0.5px solid ${dimmed ? "rgba(255,255,255,0.05)" : color + "33"}`,
      opacity: dimmed ? 0.5 : 1, transition: "opacity 0.2s",
    }}>
      {/* Piece badge */}
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: dimmed ? "rgba(255,255,255,0.04)" : `${color}18`,
        border: `1px solid ${dimmed ? "rgba(255,255,255,0.08)" : color + "44"}`,
        fontSize: 15,
      }}>
        {PIECE_EMOJI[aug.pieceType]}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 500, color: dimmed ? "#475569" : "#e2e8f0", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {aug.label}
        </div>
        <div style={{ fontSize: "0.7rem", color: "#475569", lineHeight: 1.3 }}>
          {aug.description}
        </div>
      </div>

      {/* Status pill */}
      <div style={{ flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}>
        {aug.spent ? (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "rgba(255,255,255,0.05)", color: "#334155" }}>spent</span>
        ) : (
          <span style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 5,
            background: `${color}22`, color,
            border: `0.5px solid ${color}55`,
            animation: "aug-active-glow 2s ease infinite",
          }}>
            active
          </span>
        )}
      </div>

      <style>{`
        @keyframes aug-active-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}

function DevGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function DevToggle({ label, side, augKey, activeAugments, onToggle }: {
  label: string; side: "white" | "black"; augKey: string;
  activeAugments: SideAugments; onToggle?: (side: "white" | "black", key: string) => void;
}) {
  const enabled = activeAugments[side]?.[augKey] ?? false;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 3 }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={() => onToggle?.(side, augKey)}
        style={{ accentColor: "#6366f1" }}
      />
      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{label}</span>
    </label>
  );
}