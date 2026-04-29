import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useNavigate } from "react-router-dom";

type GameRecord = {
  opponent_name: string;
  opponent_type: string;
  result: string;
  rating_change: number;
  difficulty: string;
  created_at: string;
};

type DifficultyStats = {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  avg_rating_change: number;
};

type Stats = {
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
  by_difficulty: Record<string, DifficultyStats>;
};

const RESULT_COLORS: Record<string, string> = {
  win:  "#4ade80",
  loss: "#f87171",
  draw: "#94a3b8",
};

const RESULT_LABELS: Record<string, string> = {
  win:  "Win",
  loss: "Loss",
  draw: "Draw",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   "rgba(74,222,128,0.15)",
  medium: "rgba(251,191,36,0.15)",
  hard:   "rgba(248,113,113,0.15)",
};

export default function ProfilePage() {
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Stats | null>(null);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!authLoaded || !userLoaded) return;
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) throw new Error("No token");
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, gamesRes] = await Promise.all([
          fetch("/api/stats",  { headers }),
          fetch("/api/games",  { headers }),
        ]);

        const statsData = await statsRes.json();
        const gamesData = await gamesRes.json();

        if (!statsRes.ok) throw new Error(statsData.message || "Failed to load stats");
        if (!gamesRes.ok) throw new Error(gamesData.message || "Failed to load games");

        setStats(statsData.stats);
        setGames(gamesData.games ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [authLoaded, userLoaded, getToken]);

  if (!authLoaded || !userLoaded || loading) {
    return <div className="center-screen">Loading profile...</div>;
  }

  return (
    <div className="menu-page">
      <div className="menu-card">

        {/* Header */}
        <div className="menu-top">
          <div>
            <p className="menu-badge">♟ Augmented Chess</p>
            <h1 className="menu-title">
              {user?.firstName ?? user?.fullName ?? "Player"}'s Profile
            </h1>
            <p className="menu-subtitle">Your stats, history, and performance breakdown.</p>
          </div>
          <button className="logout-btn" onClick={() => navigate("/menu")}>← Back to Menu</button>
        </div>

        {error && <div className="message error-message">{error}</div>}

        {stats && (
          <>
            {/* Overall stats chips */}
            <div className="stats-row">
              <div className="stat-chip">⭐ Rating: <strong>{stats.rating}</strong></div>
              <div className="stat-chip">✅ Wins: <strong>{stats.wins}</strong></div>
              <div className="stat-chip">❌ Losses: <strong>{stats.losses}</strong></div>
              <div className="stat-chip">🎮 Games: <strong>{stats.games_played}</strong></div>
              <div className="stat-chip">📊 Win Rate: <strong>{stats.win_rate}%</strong></div>
            </div>

            {/* Per-difficulty breakdown */}
            <div className="leaderboard-section">
              <div className="leaderboard-header">
                <h2>Performance by Difficulty</h2>
                <p>See how you do at each level.</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                {(["easy", "medium", "hard"] as const).map((level) => {
                  const d = stats.by_difficulty[level];
                  return (
                    <div
                      key={level}
                      style={{
                        padding: "18px",
                        borderRadius: "16px",
                        background: DIFFICULTY_COLORS[level],
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <h3 style={{ margin: "0 0 12px", textTransform: "capitalize", color: "#f8fafc" }}>{level}</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem", color: "#cbd5e1" }}>
                        <span>Games: <strong style={{ color: "#f8fafc" }}>{d.games}</strong></span>
                        <span>Wins: <strong style={{ color: "#4ade80" }}>{d.wins}</strong></span>
                        <span>Losses: <strong style={{ color: "#f87171" }}>{d.losses}</strong></span>
                        <span>Draws: <strong style={{ color: "#94a3b8" }}>{d.draws}</strong></span>
                        <span>Win Rate: <strong style={{ color: "#f8fafc" }}>{d.win_rate}%</strong></span>
                        <span>Avg Δ Rating: <strong style={{ color: d.avg_rating_change >= 0 ? "#4ade80" : "#f87171" }}>
                          {d.avg_rating_change >= 0 ? "+" : ""}{d.avg_rating_change}
                        </strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Recent games */}
        <div className="leaderboard-section">
          <div className="leaderboard-header">
            <h2>Recent Games</h2>
            <p>Your last {games.length} game{games.length !== 1 ? "s" : ""}.</p>
          </div>

          {games.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No games played yet. Start a match!</p>
          ) : (
            <div className="leaderboard-table">
              {/* Header */}
              <div className="leaderboard-row leaderboard-head">
                <span>Result</span>
                <span>Opponent</span>
                <span>Difficulty</span>
                <span>Δ Rating</span>
                <span>Date</span>
              </div>

              {games.map((g, i) => (
                <div key={i} className="leaderboard-row">
                  <span style={{ color: RESULT_COLORS[g.result] ?? "#f1f5f9", fontWeight: "700" }}>
                    {RESULT_LABELS[g.result] ?? g.result}
                  </span>
                  <span>{g.opponent_name}</span>
                  <span style={{ textTransform: "capitalize" }}>{g.difficulty}</span>
                  <span style={{ color: g.rating_change >= 0 ? "#4ade80" : "#f87171", fontWeight: "600" }}>
                    {g.rating_change >= 0 ? "+" : ""}{g.rating_change}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    {new Date(g.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}