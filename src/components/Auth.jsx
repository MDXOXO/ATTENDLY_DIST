import { useState } from "react";
import { supabase } from "../lib/supabase";

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clearFeedback = () => { setError(""); setMessage(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    clearFeedback();

    if (!email) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    if (forgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(error.message);
      else setMessage("Password reset instructions have been sent to your email.");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      setLoading(false);
      return;
    }

    if (!isLogin && !name.trim()) {
      setError("Please enter your name.");
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onLogin(data.user);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) setError(error.message);
      else if (data.user && !data.session) {
        setMessage("Account created. Check your email to verify your account.");
        setIsLogin(true);
      } else if (data.user) onLogin(data.user);
    }
    setLoading(false);
  };

  const switchMode = (nextLogin) => {
    setIsLogin(nextLogin);
    setForgot(false);
    clearFeedback();
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand"><div className="brand-icon">A</div><span>Attendly</span></div>
        <h1>{forgot ? "Reset your password" : isLogin ? "Welcome back" : "Create your account"}</h1>
        <p>{forgot ? "We'll send a secure password reset link to your email." : isLogin ? "Log in to access your attendance dashboard." : "Create an account to keep your attendance data synced across devices."}</p>

        <form onSubmit={handleSubmit}>
          {!isLogin && !forgot && (
            <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" /></label>
          )}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          {!forgot && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isLogin ? "current-password" : "new-password"} /></label>}
          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}
          <button className="primary-button auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait…" : forgot ? "Send reset link" : isLogin ? "Log in" : "Create account"}
          </button>
        </form>

        {isLogin && !forgot && <button className="auth-switch" type="button" onClick={() => { setForgot(true); clearFeedback(); }}>Forgot password?</button>}
        {forgot && <button className="auth-switch" type="button" onClick={() => switchMode(true)}>← Back to log in</button>}
        {!forgot && <button className="auth-switch" type="button" onClick={() => switchMode(!isLogin)}>{isLogin ? "Don't have an account? Create one" : "Already have an account? Log in"}</button>}
      </div>
    </main>
  );
}

export default Auth;
