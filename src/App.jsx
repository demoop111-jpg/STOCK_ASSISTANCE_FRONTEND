import { useMemo, useState } from "react";
import { Building2, Info, PackageCheck, ShieldCheck, Zap } from "lucide-react";
import ChatBot from "./components/ChatBot.jsx";
import BulkOrder from "./components/BulkOrder.jsx";

const companyName = import.meta.env.VITE_COMPANY_NAME || "StockFinder";

export default function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [mode, setMode] = useState("bulk");

  const highlights = useMemo(
    () => [
      "Category-wise quick stock checking",
      "Bulk item selection with confirmation",
      "Louvers batch codes only",
      "WhatsApp order handoff",
    ],
    [],
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-block" onClick={() => setMode("bulk")} aria-label="Open bulk order stock check">
          <div className="brand-icon">
            <Building2 size={22} />
          </div>
          <div>
            <h1>{companyName}</h1>
            <p className="eyebrow">Bulk Order Stock Check</p>
          </div>
        </button>

        <div className="top-actions">
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
          <button
            className="icon-btn"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="Toggle info"
          >
            <Info size={21} />
          </button>
        </div>
      </header>

      {mode === "bulk" ? (
        <main className="bulk-main">
          <BulkOrder onFastCheck={() => setMode("fast")} />
        </main>
      ) : (
        <main className="main-grid fast-check-grid">
          <section className="hero-card fast-info-card">
            <div className="pill">Fast Check</div>
            <h2>Single item stock inquiry.</h2>
            <p>Category select karo, item code enter karo, aur Tally synced stock instantly dekho.</p>
            <div className="highlight-list">
              {highlights.map((item) => (
                <div className="highlight" key={item}>
                  <ShieldCheck size={18} /> {item}
                </div>
              ))}
            </div>
          </section>

          <ChatBot />
        </main>
      )}

      {showInfo && (
        <aside className="drawer">
          <h3>Website flow</h3>
          <p>Default screen bulk order stock checker hai. Fast Check button se single item chatbot open hota hai.</p>
          <p>Mobile me selected items ka sirf count dikhega; details confirmation step par dikhenge.</p>
        </aside>
      )}
    </div>
  );
}
