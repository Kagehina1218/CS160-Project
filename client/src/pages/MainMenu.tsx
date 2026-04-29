import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useAuth, useUser } from "@clerk/react";

type Profile = {
  id: number;
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  bio: string | null;
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
};

type LeaderboardEntry = {
  rank: number;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
  is_ai: boolean;
  is_current_user: boolean;
};

type MenuCardProps = {
  title: string;
  description: string;
  onClick: () => void;
};

function MenuCard({ title, description, onClick }: MenuCardProps) {
  return (
    <button className="menu-box menu-box-button" onClick={onClick} type="button">
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="menu-action">Open</span>
    </button>
  );
}

export default function MainMenu() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!authLoaded || !userLoaded) return;
      try {
        setLoading(true);
        setError("");
        const token = await getToken();
        if (!token) throw new Error("No Clerk token found");
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

        const [profileRes, leaderboardRes] = await Promise.all([
          fetch("/api/profile",     { headers }),
          fetch("/api/leaderboard", { headers }),
        ]);

        const profileData     = await profileRes.json();
        const leaderboardData = await leaderboardRes.json();

        if (!profileRes.ok)     throw new Error(profileData.message     || "Failed to load profile");
        if (!leaderboardRes.ok) throw new Error(leaderboardData.message || "Failed to load leaderboard");

        setProfile(profileData.profile ?? null);
        setLeaderboard(leaderboardData.leaderboard ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [authLoaded, userLoaded, getToken]);

  if (!authLoaded || !userLoaded || loading) {
    return <div className="center-screen">Loading menu...</div>;
  }

  return (
    <div className="menu-page">
      <div className="menu-card">
        <div className="menu-top">
          <div>
            <p className="menu-badge">♟ Augmented Chess</p>
            <h1 className="menu-title">
              Welcome, {profile?.display_name || user?.firstName || user?.fullName || "Player"}
            </h1>
            <p className="menu-subtitle">
              Signed in with Clerk. Your profile is loaded from Flask + SQLite.
            </p>
          </div>
          <UserButton />
        </div>

        {error && <div className="message error-message">{error}</div>}

        <div className="stats-row">
          <div className="stat-chip">⭐ Rating: {profile?.rating ?? 1200}</div>
          <div className="stat-chip">✅ Wins: {profile?.wins ?? 0}</div>
          <div className="stat-chip">❌ Losses: {profile?.losses ?? 0}</div>
          <div className="stat-chip">🎮 Games: {profile?.games_played ?? 0}</div>
          <div className="stat-chip">
            📊{" "}
            {profile && profile.games_played > 0
              ? `${Math.round((profile.wins / profile.games_played) * 100)}%`
              : "0%"}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="leaderboard-section">
          <div className="leaderboard-header">
            <h2>Leaderboard</h2>
            <p>See how you rank against other players.</p>
          </div>
          <div className="leaderboard-table">
            <div className="leaderboard-row leaderboard-head">
              <span>Rank</span>
              <span>Player</span>
              <span>Rating</span>
              <span>W–L</span>
              <span>Win Rate</span>
            </div>
            {leaderboard.length === 0 ? (
              <p style={{ color: "#94a3b8", padding: "12px 0" }}>No players yet.</p>
            ) : (
              leaderboard.map((entry) => (
                <div
                  key={`${entry.name}-${entry.rank}`}
                  className={`leaderboard-row ${entry.is_current_user ? "current-user-row" : ""}`}
                >
                  <span>#{entry.rank}</span>
                  <span>
                    {entry.name} {entry.is_ai ? "🤖" : "👤"}
                    {entry.is_current_user && (
                      <span style={{ marginLeft: "6px", fontSize: "0.75rem", color: "#ec4899" }}>(you)</span>
                    )}
                  </span>
                  <span>{entry.rating}</span>
                  <span>{entry.wins}–{entry.losses}</span>
                  <span>{entry.win_rate}%</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Nav cards — Abilities and Profile now route to real pages */}
        <div className="menu-grid">
          <MenuCard
            title="Quick Match"
            description="Start a fast game and jump right into action."
            onClick={() => navigate("/game")}
          />
          <MenuCard
            title="Multiplayer"
            description="Play against other users when matchmaking is connected."
            onClick={() => alert("Multiplayer is not implemented yet.")}
          />
          <MenuCard
            title="Abilities"
            description="View all special augments and what they do."
            onClick={() => navigate("/abilities")}
          />
          <MenuCard
            title="Profile"
            description="Track your wins, rating history, and past game results."
            onClick={() => navigate("/profile")}
          />
          <MenuCard
            title="Discussion Board"
            description="Read and post difficulty-based strategy messages."
            onClick={() => navigate("/discussion")}
          />
        </div>

      </div>
    </div>
  );
}