import { useEffect, useState } from "react";
import { LockKeyhole, Loader2, UserRound, Boxes } from "lucide-react";
import { loginUser, preloadBulkCatalog } from "../api/client.js";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    preloadBulkCatalog().catch(() => {
      // Stock data will load again after login if preload fails.
    });

    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await loginUser({ username, password });
      onLogin(response.user);
    } catch (err) {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Boxes size={30} />
          </div>

          <div>
            <h1>Orange Decore</h1>
            <p>Stock Assistant</p>
          </div>
        </div>

        <div className="login-heading">
          <p className="login-eyebrow">Client Login</p>
          <h2>Welcome Back</h2>
          <span>Enter your username and password to continue.</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            <span>Username</span>
            <div className="login-input-wrap">
              <UserRound size={18} />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="login-input-wrap">
              <LockKeyhole size={18} />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                type="password"
                autoComplete="current-password"
              />
            </div>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? (
              <Loader2 className="spin" size={19} />
            ) : (
              <LockKeyhole size={19} />
            )}
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
