import { SignUp } from "@clerk/react";

export default function SignUpPage() {
  return (
    
    <div className="auth-page">
      <div className="auth-header">
  <div className="logo">♟</div>
  <h1 className="brand-title">RogueChess</h1>
  <p className="brand-subtitle">
    Play smarter. Compete harder.
  </p>
</div>
      <div className="auth-centered">
        <div className="auth-card clerk-card">
          <SignUp
            path="/sign-up"
            routing="path"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/menu"
            appearance={{
              elements: {
                card: "clerk-inner-card",
                formButtonPrimary: "clerk-primary-btn",
                formFieldInput: "clerk-input",
                socialButtonsBlockButton: "clerk-social-btn",
              },
            }}
          />
        </div>
      </div>

      <div className="auth-features-grid">
        <div className="mini-feature">
          <span>🎯</span>
          <h4>Easy</h4>
          <p>Create account fast</p>
        </div>

        <div className="mini-feature">
          <span>🧩</span>
          <h4>Profile</h4>
          <p>Auto created</p>
        </div>

        <div className="mini-feature">
          <span>🌈</span>
          <h4>Clear UI</h4>
          <p>Simple navigation</p>
        </div>
      </div>
    </div>
  );
}