import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Info,
  LogOut,
  PackageCheck,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import ChatBot from "./components/ChatBot.jsx";
import BulkOrder from "./components/BulkOrder.jsx";
import LoginPage from "./components/LoginPage.jsx";
import UserManagement from "./components/UserManagement.jsx";
import {
  fetchCurrentUser,
  getCurrentUser,
  logoutUser,
  preloadBulkCatalog,
} from "./api/client.js";

const companyName = import.meta.env.VITE_COMPANY_NAME || "Stock ";

export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("bulk");
  const [authUser, setAuthUser] = useState(getCurrentUser());
  const [checkingSession, setCheckingSession] = useState(
    Boolean(getCurrentUser()),
  );
  const isUserManagement =
    window.location.pathname.replace(/\/+$/, "") === "/user-management";

  useEffect(() => {
    preloadBulkCatalog().catch(() => { });

    if (getCurrentUser()) {
      fetchCurrentUser()
        .then((response) => setAuthUser(response.user))
        .catch(() => {
          logoutUser();
          setAuthUser(null);
        })
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }
  }, []);

  const highlights = useMemo(
    () => [
      "Category-wise quick stock checking",
      "Bulk item selection with confirmation",
      "Louvers batch codes only",
      "WhatsApp order handoff",
    ],
    [],
  );

  function handleLogout() {
    logoutUser();
    setAuthUser(null);
    setMode("bulk");
  }

  if (isUserManagement) {
    return <UserManagement />;
  }

  if (checkingSession) {
    return (
      <div className="app-shell">
        <main className="login-page">
          <section className="login-card">
            <div className="login-icon">
              <ShieldCheck size={28} />
            </div>
            <h1>Checking session...</h1>
            <p className="login-subtitle">Please wait.</p>
          </section>
        </main>
      </div>
    );
  }

  if (!authUser) {
    // return <LoginPage onLogin={setAuthUser} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand-block"
          onClick={() => setMode("bulk")}
          aria-label="Open bulk order stock check"
        >
          <div className="brand-icon">
            <Building2 size={22} />
          </div>
          <div>
            <h1>{companyName}</h1>
            <p className="eyebrow">Bulk Order Stock Assistant</p>
          </div>
        </button>

        <div className="top-actions">
          <div className="logged-user-pill" title={authUser.username}>
            <UserRound size={16} /> {authUser.name}
          </div>
          <button
            className={`mode-btn ${mode === "bulk" ? "active" : ""}`}
            onClick={() => setMode("bulk")}
          >
            <PackageCheck size={17} /> Bulk Order
          </button>
          <button
            className={`mode-btn fast-mode ${mode === "fast" ? "active" : ""}`}
            onClick={() => setMode("fast")}
          >
            <Zap size={17} /> Fast Check
          </button>
          {/* <button
            className="icon-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Toggle info"
          >
            <Info size={21} />
          </button> */}
          <button className="mode-btn logout-btn" onClick={handleLogout}>
            <LogOut size={17} /> Logout
          </button>
        </div>
      </header>

      {mode === "bulk" ? (
        <main className="bulk-main">
          <BulkOrder onFastCheck={() => setMode("fast")} authUser={authUser} />
        </main>
      ) : (
        <main className="main-grid fast-check-grid">
          <section className="hero-card fast-info-card">
            <div className="pill">Fast Check</div>
            <h2>Single item stock inquiry.</h2>
            <p>
              Category select karo, item code enter karo, aur Tally synced stock
              instantly dekho.
            </p>
            <div className="highlight-list">
              {highlights.map((item) => (
                <div className="highlight" key={item}>
                  <ShieldCheck size={18} /> {item}
                </div>
              ))}
            </div>
          </section>

          <ChatBot authUser={authUser} />
        </main>
      )}

      {showInfo && (
        <aside className="drawer">
          <h3>Website flow</h3>
          <p>
            Default screen bulk order stock checker hai. Fast Check button se
            single item chatbot open hota hai.
          </p>
          <p>
            Logged-in client name automatically stores with inquiries and
            orders.
          </p>
        </aside>
      )}
    </div>
  );
}
