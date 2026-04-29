import { SignIn } from "@clerk/react";

export default function Login() {
  return (
    <div className="auth-page">
      <div className="auth-header">
  <div className="logo">♟</div>
  <h1 className="brand-title">Augmented Chess</h1>
  <p className="brand-subtitle">
    Play smarter. Compete harder.
  </p>
</div>
      {/* CENTER LOGIN */}
      <div className="auth-centered">
        <div className="auth-card clerk-card">
          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
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

      {/* SMALL FEATURE BOXES BELOW */}
      <div className="auth-features-grid">
        <div className="mini-feature">
          <span>🔐</span>
          <h4>Secure</h4>
          <p>Google & email login</p>
        </div>

        <div className="mini-feature">
          <span>⚡</span>
          <h4>Fast</h4>
          <p>Instant access</p>
        </div>

        <div className="mini-feature">
          <span>♜</span>
          <h4>Augmented Chess</h4>
          <p>Connected backend</p>
        </div>
      </div>
    </div>
  );
}