import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import Login from "./pages/Login";
import SignUpPage from "./pages/SignUp";
import MainMenu from "./pages/MainMenu";
import DiscussionBoard from "./pages/DiscussionBoard";
import ChessBoard from "./pages/ChessBoard";
import ProfilePage from "./pages/Profile";
import AbilitiesPage from "./pages/Abilities";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="/sign-in/*" element={<Login />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />

      <Route path="/menu" element={<ProtectedRoute><MainMenu /></ProtectedRoute>} />
      <Route path="/discussion" element={<ProtectedRoute><DiscussionBoard /></ProtectedRoute>} />
      <Route path="/game" element={<ProtectedRoute><ChessBoard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/abilities" element={<ProtectedRoute><AbilitiesPage /></ProtectedRoute>} />
    </Routes>
  );
}