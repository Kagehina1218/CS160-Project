import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    navigate("/login");
  };

  const handleComingSoon = (feature: string) => {
    alert(`${feature} is not implemented yet.`);
  };

  return (
    <div className="menu-page">
      <div className="menu-card">
        <div className="menu-top">
          <div>
            <p className="menu-badge">♟ RogueChess</p>
            <h1 className="menu-title">Main Menu</h1>
            <p className="menu-subtitle">
              You have successfully logged in.
            </p>
          </div>

          <button className="logout-btn" onClick={handleLogout} type="button">
            Logout
          </button>
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
            description="Track progress, wins, and future saved game history."
            onClick={() => handleComingSoon("Profile")}
          />
        </div>
      </div>
    </div>
  );
}