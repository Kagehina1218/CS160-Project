// import AuthForm from "./pages/Login";
import {Routes, Route, Navigate }  from "react-router-dom";
import Login from "./pages/Login";
import MainMenu from "./pages/MainMenu";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route 
        path="/menu" 
        element={
          <ProtectedRoute>
            <MainMenu />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;