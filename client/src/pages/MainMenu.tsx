import { useNavigate } from "react-router-dom";

export default function MainMenu() {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear the token from localStorage
        localStorage.removeItem("isLoggedIn");
        navigate("/login");
    };

    return (
        <div>
            <h1>Main Menu</h1>
            <p>You have successfully logged in!</p>

            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}