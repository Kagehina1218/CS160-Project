import { useEffect, useState } from "react";
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!authLoaded || !userLoaded) return;

      try {
        setLoading(true);
        setError("");

        const token = await getToken();

        if (!token) {
          throw new Error("No Clerk token found");
        }

        const res = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const text = await res.text();
        let data: { message?: string; profile?: Profile } = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error("Backend returned invalid JSON");
        }

        if (!res.ok) {
          throw new Error(data.message || "Failed to load profile");
        }

        setProfile(data.profile ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [authLoaded, userLoaded, getToken]);

  const handleComingSoon = (feature: string) => {
    alert(`${feature} is not implemented yet.`);
  };

  if (!authLoaded || !userLoaded || loading) {
    return <div className="center-screen">Loading menu...</div>;
  }

  return (
    <div className="menu-page">
      <div className="menu-card">
        <div className="menu-top">
          <div>
            <p className="menu-badge">♟ RogueChess</p>
            <h1 className="menu-title">
              Welcome, {profile?.display_name || user?.firstName || user?.fullName || "Player"}
            </h1>
            <p className="menu-subtitle">
              Signed in with Clerk. Your app profile is loaded from Flask + SQLite.
            </p>
          </div>

          <UserButton />
        </div>

        {error && <div className="message error-message">{error}</div>}

        <div className="stats-row">
          <div className="stat-chip">Rating: {profile?.rating ?? 1200}</div>
          <div className="stat-chip">Wins: {profile?.wins ?? 0}</div>
          <div className="stat-chip">Losses: {profile?.losses ?? 0}</div>
          <div className="stat-chip">Games: {profile?.games_played ?? 0}</div>
        </div>

        <div className="menu-grid">
          <MenuCard
            title="Quick Match"
            description="Start a fast game and jump right into action."
            onClick={() => handleComingSoon("Quick Match")}
          />
          <MenuCard
            title="Multiplayer"
            description="Play against other users when matchmaking is connected."
            onClick={() => handleComingSoon("Multiplayer")}
          />
          <MenuCard
            title="Abilities"
            description="View special roguelike upgrades and match modifiers."
            onClick={() => handleComingSoon("Abilities")}
          />
          <MenuCard
            title="Profile"
            description="Track progress, wins, streaks, and saved data."
            onClick={() => handleComingSoon("Profile")}
          />
        </div>
      </div>
    </div>
  );
}