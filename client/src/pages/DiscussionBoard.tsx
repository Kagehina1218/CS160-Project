import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useNavigate } from "react-router-dom";

type Message = {
  id: number;
  username: string;
  clerk_user_id: string;
  message: string;
  timestamp: string;
};

export default function DiscussionBoard() {
  const { getToken, isLoaded } = useAuth();
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState("easy");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMessages = async (selectedDifficulty: string) => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();

      if (!token) {
        throw new Error("No Clerk token found");
      }

      const res = await fetch(`/api/messages/${selectedDifficulty}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(data.message || "Failed to load messages");
      }

      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    void fetchMessages(difficulty);
  }, [isLoaded, difficulty]);

  const handlePostMessage = async () => {
    try {
      setError("");

      const trimmedMessage = newMessage.trim();
      if (!trimmedMessage) {
        setError("Message cannot be empty");
        return;
      }

      const token = await getToken();

      if (!token) {
        throw new Error("No Clerk token found");
      }

      const res = await fetch(`/api/messages/${difficulty}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmedMessage,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(data.message || "Failed to post message");
      }

      setMessages(data.messages ?? []);
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post message");
    }
  };

  if (!isLoaded || loading) {
    return <div className="center-screen">Loading discussion board...</div>;
  }

  return (
    <div className="menu-page">
      <div className="menu-card">
        <div className="menu-top">
          <div>
            <p className="menu-badge">♟ RogueChess</p>
            <h1 className="menu-title">Discussion Board</h1>
            <p className="menu-subtitle">
              Leave notes and strategy tips by difficulty.
            </p>
          </div>

          <button type="button" className="menu-box-button" onClick={() => navigate("/menu")}>
            Back to Menu
          </button>
        </div>

        {error && <div className="message error-message">{error}</div>}

        <div className="stats-row">
          <button type="button" className="stat-chip" onClick={() => setDifficulty("easy")}>
            Easy
          </button>
          <button type="button" className="stat-chip" onClick={() => setDifficulty("medium")}>
            Medium
          </button>
          <button type="button" className="stat-chip" onClick={() => setDifficulty("hard")}>
            Hard
          </button>
        </div>

        <div className="leaderboard-section">
          <div className="leaderboard-header">
            <h2>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Messages</h2>
            <p>Read previous notes or post your own.</p>
          </div>

          <div className="leaderboard-table">
            {messages.length === 0 ? (
              <p>No messages yet for this difficulty.</p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="leaderboard-row" style={{ display: "block" }}>
                  <strong>{msg.username}</strong>
                  <p style={{ margin: "0.35rem 0" }}>{msg.message}</p>
                  <small>{msg.timestamp}</small>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Write a message for ${difficulty} mode...`}
            rows={4}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "12px",
              marginBottom: "0.75rem",
            }}
          />
          <button type="button" className="menu-box menu-box-button" onClick={handlePostMessage}>
            Post Message
          </button>
        </div>
      </div>
    </div>
  );
}