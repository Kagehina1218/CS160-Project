import { useNavigate } from "react-router-dom";

type AugmentInfo = {
  key: string;
  name: string;
  icon: string;
  piece: string;
  description: string;
};

const AUGMENTS: AugmentInfo[] = [
  // Pawn
  {
    key: "pawn_two_hits",
    name: "Tough Pawns",
    icon: "♟",
    piece: "Pawn",
    description: "Your pawns require 2 captures to be removed. The first hit marks the pawn as damaged — it survives but is visually weakened.",
  },
  {
    key: "pawn_explosion",
    name: "Martyr Pawn",
    icon: "💥",
    piece: "Pawn",
    description: "When your pawn is captured, it explodes — removing all adjacent enemy pieces in the 8 surrounding squares (the king is immune).",
  },
  {
    key: "pawn_double_push",
    name: "Double March",
    icon: "♟",
    piece: "Pawn",
    description: "Your pawns can always move 2 squares forward — not just from the starting rank. The path must be clear.",
  },
  // Knight
  {
    key: "knight_long_jump",
    name: "Long Jump",
    icon: "♞",
    piece: "Knight",
    description: "The knight gains an additional movement pattern: a 4×1 leap in any direction, dramatically extending its reach.",
  },
  {
    key: "knight_second_move_after_capture",
    name: "Capture & Dash",
    icon: "♞",
    piece: "Knight",
    description: "When the knight captures a piece, it earns a free second move immediately after.",
  },
  // Bishop
  {
    key: "bishop_phase",
    name: "Phase Through",
    icon: "♝",
    piece: "Bishop",
    description: "The bishop can pass through exactly one blocking piece on its diagonal path, landing anywhere beyond it.",
  },
  {
    key: "bishop_double_move",
    name: "Double Move",
    icon: "♝",
    piece: "Bishop",
    description: "After a non-capturing bishop move, the bishop may move again on the same turn. Capturing ends the turn immediately.",
  },
  // Rook
  {
    key: "rook_triple_move_bonus",
    name: "Power Slide",
    icon: "♜",
    piece: "Rook",
    description: "Moving the rook 3 or more squares earns it a free bonus move — use it for an extra attack or repositioning.",
  },
  {
    key: "rook_pawn_shield",
    name: "Pawn Shield",
    icon: "🛡️",
    piece: "Rook",
    description: "Enemy pawns cannot capture your rooks. They are blocked from moving onto any square your rook occupies.",
  },
  // Queen
  {
    key: "queen_teleport",
    name: "Blink",
    icon: "✨",
    piece: "Queen",
    description: "Once per game, your queen can teleport to any empty square on the board. This uses up your turn. Cannot capture.",
  },
  {
    key: "queen_pawn_shield",
    name: "Royal Guard",
    icon: "🛡️",
    piece: "Queen",
    description: "Enemy pawns cannot capture your queen. They are blocked from moving onto any square your queen occupies.",
  },
  // King
  {
    key: "king_guard",
    name: "Guard Zone",
    icon: "♚",
    piece: "King",
    description: "The four orthogonally adjacent squares around your king become forbidden territory for all enemy pieces.",
  },
  {
    key: "king_stride",
    name: "Stride",
    icon: "♚",
    piece: "King",
    description: "Your king can move up to 2 squares in any direction (including diagonals). It cannot capture when moving beyond 1 square.",
  },
];

const PIECE_COLORS: Record<string, { bg: string; border: string }> = {
  Pawn:   { bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)" },
  Knight: { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)" },
  Bishop: { bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)" },
  Rook:   { bg: "rgba(14,165,233,0.12)",  border: "rgba(14,165,233,0.3)" },
  Queen:  { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)" },
  King:   { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.3)" },
};

const PIECE_ORDER = ["Pawn", "Knight", "Bishop", "Rook", "Queen", "King"];

export default function AbilitiesPage() {
  const navigate = useNavigate();

  const grouped = PIECE_ORDER.map((piece) => ({
    piece,
    augments: AUGMENTS.filter((a) => a.piece === piece),
  }));

  return (
    <div className="menu-page">
      <div className="menu-card">
        <div className="menu-top">
          <div>
            <p className="menu-badge">♟ RogueChess</p>
            <h1 className="menu-title">Abilities</h1>
            <p className="menu-subtitle">
              All augments available in RogueChess. Enable them in-game via Dev Controls.
            </p>
          </div>
          <button className="logout-btn" onClick={() => navigate("/menu")}>← Back to Menu</button>
        </div>

        {grouped.map(({ piece, augments }) => {
          const colors = PIECE_COLORS[piece] ?? { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" };
          return (
            <div key={piece} style={{ marginBottom: "28px" }}>
              <h2 style={{ margin: "0 0 14px", color: "#f8fafc", fontSize: "1.15rem", borderBottom: `1px solid ${colors.border}`, paddingBottom: "8px" }}>
                {piece} Augments
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: "14px" }}>
                {augments.map((aug) => (
                  <div
                    key={aug.key}
                    style={{
                      padding: "18px 20px",
                      borderRadius: "16px",
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      transition: "transform 0.18s ease, box-shadow 0.18s ease",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 28px rgba(0,0,0,0.28)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "1.5rem" }}>{aug.icon}</span>
                      <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "0.97rem" }}>{aug.name}</h3>
                    </div>
                    <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.86rem", lineHeight: "1.6" }}>
                      {aug.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}