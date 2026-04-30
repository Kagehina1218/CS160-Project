import { useEffect, useState } from "react";
import { useAuth, UserButton } from "@clerk/react";
import { useNavigate } from "react-router-dom";

type Message = {
  user: string;
  message: string;
  timestamp?: string;
};

export default function DiscussionBoard() {
  const { getToken, isLoaded } = useAuth();
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState("easy");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState("");

  const fetchMessages = async () => {
    try {
      setError("");

      const token = await getToken();
      if (!token) throw new Error("No Clerk token found");

      const res = await fetch(`/api/messages/${difficulty}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to load messages");
      }

      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  };

  const postMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setError("");

      const token = await getToken();
      if (!token) throw new Error("No Clerk token found");

      const res = await fetch(`/api/messages/${difficulty}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to post message");
      }

      setMessages(data.messages || []);
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post message");
    }
  };

  useEffect(() => {
    if (isLoaded) {
      void fetchMessages();
    }
  }, [isLoaded, difficulty]);

  if (!isLoaded) {
    return <div className="center-screen">Loading discussion board...</div>;
  }

  return (
    <div className="menu-page">
      <div className="menu-card">
        <div className="menu-top">
          <div>
            <p className="menu-badge">💬 Discussion Board</p>
            <h1 className="menu-title">Strategy Messages</h1>
            <p className="menu-subtitle">
              Read and post messages based on game difficulty.
            </p>
          </div>

          <UserButton />
        </div>

        {error && <div className="message error-message">{error}</div>}

        <div style={{ marginBottom: "16px" }}>
          <button onClick={() => setDifficulty("easy")}>Easy</button>
          <button onClick={() => setDifficulty("medium")}>Medium</button>
          <button onClick={() => setDifficulty("hard")}>Hard</button>
        </div>

        <div className="leaderboard-section">
          <h2>{difficulty.toUpperCase()} Messages</h2>

          {messages.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No messages yet.</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className="message" style={{ marginBottom: "10px" }}>
                <strong>{msg.user || "Player"}</strong>
                <p>{msg.message}</p>
                {msg.timestamp && <small>{msg.timestamp}</small>}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: "20px" }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message..."
            rows={4}
            style={{ width: "100%" }}
          />

          <button onClick={postMessage} style={{ marginTop: "10px" }}>
            Post Message
          </button>

          <button onClick={() => navigate("/menu")} style={{ marginLeft: "10px" }}>
            Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
}