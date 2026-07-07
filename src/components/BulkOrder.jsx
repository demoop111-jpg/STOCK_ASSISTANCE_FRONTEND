import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  bookBulkOrder,
  buildBulkOrderWhatsAppLink,
  checkBulkStock,
  getBulkCatalog,
  PRODUCT_CATEGORIES,
} from "../api/client.js";

const GROUP_WHITELIST = {
  louvers: ["L", "H", "LS", "ON", "8000"],
  asa_sheet: ["OSAM", "OSAG"],
  laminate_sheet: ["HGL", "PST", "SF", "TX"],
  acrylic_sheet: ["D", "DM", "G", "ML", "NM", "SP"],
};

const GROUP_LABELS = {
  louvers: "Series",
  asa_sheet: "Type",
  laminate_sheet: "Type",
  acrylic_sheet: "Type",
  paintable: "Series",
};

function emptyCatalog() {
  return PRODUCT_CATEGORIES.map((category) => ({
    ...category,
    groups: [],
    totalItems: 0,
  }));
}

function compact(value = "") {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function formatCode(prefix, number) {
  if (!prefix || !number) return `${prefix || ""}${number || ""}`;
  return `${prefix.toUpperCase()}-${number}`;
}

function extractDisplayCode(categoryId, item = {}) {
  const original = String(item.displayCode || item.productCode || "").trim();
  const source = String(item.productCode || item.displayCode || "").trim();
  const text = `${original} ${source}`;
  const clean = compact(text);

  if (categoryId === "paintable") return source || original;

  if (categoryId === "asa_sheet") {
    const match = clean.match(/(OSAM|OSAG)(\d+)/);
    if (match) return formatCode(match[1], match[2]);
  }

  if (categoryId === "laminate_sheet") {
    const match = clean.match(/(HGL|PST|SF|TX)(\d+)/);
    if (match) return formatCode(match[1], match[2]);
  }

  if (categoryId === "acrylic_sheet") {
    const match = clean.match(/(DM|ML|NM|SP|D|G)(\d+)/);
    if (match) return formatCode(match[1], match[2]);
  }

  if (categoryId === "louvers") {
    const normalized = source || original;
    return normalized.replace(/\s*\((8|9\.5)\s*FT\)\s*$/i, "").trim();
  }

  return original;
}

function getLouverSizeLabel(item = {}) {
  const text = String(item.productCode || item.displayCode || "").toUpperCase();
  if (/9\.5\s*FT/.test(text) || /95FT/.test(compact(text))) return "9.5 FT";
  if (/8\s*FT/.test(text) || /8FT/.test(compact(text))) return "8 FT";
  if (/^8\d{3}/.test(compact(text))) return "8 FT";
  return "";
}

function itemMeta(categoryId, item = {}) {
  if (categoryId === "louvers") return getLouverSizeLabel(item);
  if (categoryId === "paintable") return "";
  return "";
}

function getGroupToken(categoryId, group = {}) {
  const label = String(group.label || group.key || "")
    .trim()
    .toUpperCase();
  const key = String(group.key || group.label || "")
    .trim()
    .toUpperCase();
  const both = `${key} ${label}`;
  const clean = compact(both);

  if (categoryId === "louvers") {
    if (/^8000/.test(clean) || /^80\d/.test(clean)) return "8000";
    if (/^LS/.test(clean)) return "LS";
    if (/^ON/.test(clean)) return "ON";
    if (/^H\d*/.test(clean)) return "H";
    if (/^L\d*/.test(clean)) return "L";
  }

  if (categoryId === "asa_sheet") {
    if (clean.startsWith("OSAM")) return "OSAM";
    if (clean.startsWith("OSAG")) return "OSAG";
  }

  if (categoryId === "laminate_sheet") {
    if (clean.startsWith("HGL")) return "HGL";
    if (clean.startsWith("PST")) return "PST";
    if (clean.startsWith("SF")) return "SF";
    if (clean.startsWith("TX")) return "TX";
  }

  if (categoryId === "acrylic_sheet") {
    if (clean.startsWith("DM") || clean.includes("DESIGNERMATT")) return "DM";
    if (clean.startsWith("ML") || clean.includes("METAL")) return "ML";
    if (clean.startsWith("NM") || clean.includes("NEWMATT")) return "NM";
    if (clean.startsWith("SP") || clean.includes("SPARK")) return "SP";
    if (clean.startsWith("G") || clean.includes("GLOSSY")) return "G";
    if (clean.startsWith("D") || clean.includes("DESIGNER")) return "D";
  }

  const allowed = GROUP_WHITELIST[categoryId] || [];
  return (
    allowed.find(
      (token) => clean === compact(token) || clean.startsWith(compact(token)),
    ) || ""
  );
}

function getItemGroupToken(categoryId, item = {}) {
  const display = compact(extractDisplayCode(categoryId, item));
  const source = compact(`${item.displayCode || ""} ${item.productCode || ""}`);

  if (categoryId === "louvers") {
    if (/^80\d/.test(display) || /^80\d/.test(source)) return "8000";
    if (display.startsWith("LS") || source.startsWith("LS")) return "LS";
    if (display.startsWith("ON") || source.startsWith("ON")) return "ON";
    if (display.startsWith("H") || source.startsWith("H")) return "H";
    if (display.startsWith("L") || source.startsWith("L")) return "L";
  }

  if (categoryId === "asa_sheet") {
    if (display.startsWith("OSAM") || source.includes("OSAM")) return "OSAM";
    if (display.startsWith("OSAG") || source.includes("OSAG")) return "OSAG";
  }

  if (categoryId === "laminate_sheet") {
    return (
      ["HGL", "PST", "SF", "TX"].find(
        (token) => display.startsWith(token) || source.includes(token),
      ) || ""
    );
  }

  if (categoryId === "acrylic_sheet") {
    return (
      ["DM", "ML", "NM", "SP", "D", "G"].find(
        (token) => display.startsWith(token) || source.includes(token),
      ) || ""
    );
  }

  return "";
}

function filterAndSortGroups(categoryId, groups = []) {
  const allowed = GROUP_WHITELIST[categoryId];
  if (!allowed?.length) return groups;

  const map = new Map();

  groups.forEach((group) => {
    const token = getGroupToken(categoryId, group);
    if (!token || !allowed.includes(token)) return;

    const existing = map.get(token) || {
      key: token,
      label: token,
      uiToken: token,
      items: [],
      totalItems: 0,
    };

    const merged = [...existing.items];
    const seen = new Set(merged.map((item) => item.productCode));

    (group.items || []).forEach((item) => {
      const itemToken = getItemGroupToken(categoryId, item);
      if (itemToken && itemToken !== token) return;
      if (!seen.has(item.productCode)) {
        merged.push(item);
        seen.add(item.productCode);
      }
    });

    existing.items = merged;
    existing.totalItems = merged.length;
    map.set(token, existing);
  });

  return Array.from(map.values()).sort(
    (a, b) => allowed.indexOf(a.uiToken) - allowed.indexOf(b.uiToken),
  );
}

function getLouverSubSeries(groupToken, item = {}) {
  if (groupToken === "8000") return "";

  const rawCode = String(
    extractDisplayCode("louvers", item) || item.productCode || "",
  )
    .toUpperCase()
    .trim();
  const prefix = String(groupToken || "")
    .toUpperCase()
    .trim();

  if (!["L", "H", "LS", "ON"].includes(prefix)) return "";

  const escapeRegex = (value = "") =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const safePrefix = escapeRegex(prefix);
  const compactCode = compact(rawCode);

  const matchByDigits = (digitCount) => {
    const rawMatch = rawCode.match(
      new RegExp(`^(${safePrefix}\\d{${digitCount}})(?=$|[^0-9])`, "i"),
    );
    if (rawMatch?.[1]) return rawMatch[1].toUpperCase();

    const compactMatch = compactCode.match(
      new RegExp(`^(${safePrefix}\\d{${digitCount}})(?=$|[^0-9])`, "i"),
    );
    if (compactMatch?.[1]) return compactMatch[1].toUpperCase();

    return "";
  };

  return matchByDigits(2) || matchByDigits(3) || prefix;
}

function getSubSeriesOptions(categoryId, group = null) {
  if (categoryId !== "louvers" || !group || group.uiToken === "8000") return [];
  const set = new Set();
  (group.items || []).forEach((item) => {
    const sub = getLouverSubSeries(group.uiToken, item);
    if (sub) set.add(sub);
  });
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function isSelected(cart, productCode) {
  return cart.some((item) => item.productCode === productCode);
}

function selectedItem(cart, productCode) {
  return cart.find((item) => item.productCode === productCode) || null;
}

function formatQty(value) {
  const qty = Number(value || 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function resultIsAvailable(item) {
  return item?.available === true;
}

function buildCsv(results = []) {
  const rows = [
    ["Item Code", "Required Qty", "Available Qty", "Status"],
    ...results.map((item) => [
      item.displayCode || item.productCode || "",
      item.requestedQty || "",
      item.stockQty ?? "",
      item.available
        ? "Available"
        : Number(item.stockQty || 0) > 0
          ? "Short Stock"
          : "Unavailable",
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}

export default function BulkOrder({ onFastCheck, authUser }) {
  const [catalog, setCatalog] = useState(emptyCatalog());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState("louvers");
  const [activeGroupKey, setActiveGroupKey] = useState("");
  const [activeSubSeries, setActiveSubSeries] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [reviewMode, setReviewMode] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const [transportName, setTransportName] = useState("");
  const [orderSaving, setOrderSaving] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    let alive = true;

    // async function load() {
    //   try {
    //     const response = await getBulkCatalog();
    //     if (alive && response?.categories?.length) {
    //       setCatalog(response.categories);
    //       const firstCategory = response.categories[0];
    //       const firstGroups = filterAndSortGroups(
    //         firstCategory.id,
    //         firstCategory.groups || [],
    //       );
    //       setActiveCategoryId(firstCategory.id);
    //       setActiveGroupKey(firstGroups?.[0]?.key || "");
    //     }
    //   } catch (err) {
    //     if (alive) setError("Catalog load nahi hua. Backend/DB check karo.");
    //   }
    // }

    async function load() {
      setCatalogLoading(true);

      try {
        const response = await getBulkCatalog();

        if (alive && response?.categories?.length) {
          setCatalog(response.categories);

          const firstCategory = response.categories[0];
          const firstGroups = filterAndSortGroups(
            firstCategory.id,
            firstCategory.groups || [],
          );

          setActiveCategoryId(firstCategory.id);
          setActiveGroupKey(firstGroups?.[0]?.key || "");
        }
      } catch (err) {
        if (alive)
          setError(
            "Catalog could not be loaded. Please check the backend or database connection.",
          );
      } finally {
        if (alive) setCatalogLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const activeCategory = useMemo(() => {
    return (
      catalog.find((category) => category.id === activeCategoryId) ||
      catalog[0] ||
      null
    );
  }, [catalog, activeCategoryId]);

  const activeGroups = useMemo(() => {
    return filterAndSortGroups(
      activeCategory?.id,
      activeCategory?.groups || [],
    );
  }, [activeCategory]);

  useEffect(() => {
    if (!activeGroups.length) {
      setActiveGroupKey("");
      return;
    }
    if (!activeGroups.some((group) => group.key === activeGroupKey)) {
      setActiveGroupKey(activeGroups[0].key);
    }
  }, [activeCategoryId, activeGroups, activeGroupKey]);

  const activeGroup =
    activeGroups.find((group) => group.key === activeGroupKey) ||
    activeGroups[0] ||
    null;
  const subSeriesOptions = useMemo(
    () => getSubSeriesOptions(activeCategory?.id, activeGroup),
    [activeCategory?.id, activeGroup],
  );

  useEffect(() => {
    if (!subSeriesOptions.length) {
      setActiveSubSeries("");
      return;
    }
    if (!subSeriesOptions.includes(activeSubSeries)) {
      setActiveSubSeries(subSeriesOptions[0]);
    }
  }, [activeGroupKey, subSeriesOptions, activeSubSeries]);

  const visibleItems = useMemo(() => {
    const q = compact(search);
    let items = activeGroup?.items || [];

    if (
      activeCategory?.id === "louvers" &&
      activeGroup?.uiToken !== "8000" &&
      activeSubSeries
    ) {
      items = items.filter(
        (item) =>
          getLouverSubSeries(activeGroup.uiToken, item) === activeSubSeries,
      );
    }

    const prepared = items.map((item) => ({
      ...item,
      uiCode: extractDisplayCode(activeCategory?.id, item),
      uiMeta: itemMeta(activeCategory?.id, item),
    }));

    if (!q) return prepared;

    return prepared.filter((item) => {
      const display = compact(item.uiCode);
      const product = compact(item.productCode);
      const meta = compact(item.uiMeta);
      return (
        display.includes(q) ||
        product.includes(q) ||
        product.startsWith(q) ||
        meta.includes(q)
      );
    });
  }, [activeCategory?.id, activeGroup, activeSubSeries, search]);

  const resultItems = results?.items || [
    ...(results?.availableItems || []),
    ...(results?.notAvailableItems || []),
  ];
  const availableResults = resultItems.filter(resultIsAvailable);
  const notAvailableResults = resultItems.filter(
    (item) => !resultIsAvailable(item),
  );
  const canCheck =
    cart.length > 0 && cart.every((item) => Number(item.requestedQty) > 0);

  function selectCategory(categoryId) {
    setActiveCategoryId(categoryId);
    setSearch("");
    setResults(null);
    setReviewMode(false);
    setCartPreviewOpen(false);
    setTransportName("");
  }

  function selectGroup(groupKey) {
    setActiveGroupKey(groupKey);
    setSearch("");
    setResults(null);
    setCartPreviewOpen(false);
    setTransportName("");
  }

  function resetBulk() {
    setCart([]);
    setResults(null);
    setReviewMode(false);
    setSearch("");
    setError("");
    setMobileCartOpen(false);
    setCartPreviewOpen(false);
    setTransportName("");
  }

  function addItem(item) {
    setResults(null);
    setCart((prev) => {
      const exists = prev.some(
        (cartItem) => cartItem.productCode === item.productCode,
      );
      if (exists) return prev;

      return [
        ...prev,
        {
          categoryId: activeCategory?.id,
          categoryName: activeCategory?.categoryName || activeCategory?.label,
          companyName: activeCategory?.companyName,
          productCode: item.productCode,
          displayCode: extractDisplayCode(activeCategory?.id, item),
          displayMeta: itemMeta(activeCategory?.id, item),
          requestedQty: 1,
          stockQty: item.stockQty,
          quantityText: item.quantityText,
        },
      ];
    });
  }

  function setCartQty(productCode, value) {
    setResults(null);
    const rawValue = String(value ?? "");
    if (rawValue === "") {
      setCart((prev) =>
        prev.map((item) =>
          item.productCode === productCode
            ? { ...item, requestedQty: "" }
            : item,
        ),
      );
      return;
    }

    const qty = Number(rawValue);
    if (!Number.isFinite(qty) || qty < 0) return;

    setCart((prev) =>
      prev.map((item) =>
        item.productCode === productCode
          ? { ...item, requestedQty: qty }
          : item,
      ),
    );
  }

  function adjustQty(productCode, delta) {
    const current = cart.find((item) => item.productCode === productCode);
    if (!current) return;
    const next = Math.max(1, formatQty(current.requestedQty) + delta);
    setCartQty(productCode, next);
  }

  function removeItem(productCode) {
    setResults(null);
    setCart((prev) => {
      const next = prev.filter((item) => item.productCode !== productCode);
      if (!next.length) {
        setMobileCartOpen(false);
        setCartPreviewOpen(false);
      }
      return next;
    });
  }

  function handleItemClick(item) {
    if (!isSelected(cart, item.productCode)) addItem(item);
  }

  function openReview() {
    if (!cart.length) return;
    if (!canCheck) {
      setError("Please add valid quantity for all selected items.");
      return;
    }
    setError("");
    setReviewMode(true);
  }

  async function confirmCheckStock() {
    if (!canCheck) {
      setError("Please add valid quantity for all selected items.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cleanCart = cart.map((item) => ({
        ...item,
        requestedQty: Number(item.requestedQty),
      }));
      const response = await checkBulkStock(cleanCart);
      setResults(response);
      setReviewMode(false);
      setCartPreviewOpen(false);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    } catch (err) {
      setError("Stock check failed. Backend connection ya API check karo.");
    } finally {
      setLoading(false);
    }
  }

  function downloadResults() {
    const csv = buildCsv(resultItems);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-check-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendBulkOrder() {
    if (!cart.length || !resultItems.length) return;
    const cleanTransport = transportName.trim();
    if (cleanTransport.length < 2) {
      setError("Please enter transport name before sending order.");
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
      return;
    }

    setOrderSaving(true);
    setError("");

    try {
      const response = await bookBulkOrder({
        items: cart,
        results: resultItems,
        transportName: cleanTransport,
      });

      if (response?.whatsappLink) {
        window.open(response.whatsappLink, "_blank", "noopener,noreferrer");
      } else {
        window.open(
          buildBulkOrderWhatsAppLink({
            items: cart,
            results: resultItems,
            user: authUser,
            transportName: cleanTransport,
          }),
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch (err) {
      setError(
        "Order could not be saved. Please check backend connection and try again.",
      );
    } finally {
      setOrderSaving(false);
    }
  }

  const whatsappLink = buildBulkOrderWhatsAppLink({
    items: cart,
    results: resultItems,
    user: authUser,
    transportName,
  });

  if (catalogLoading) {
    return (
      <section className="bulk-shell">
        <div className="bulk-loading-screen">
          <Loader2 className="spin" size={34} />
          <h3>Loading stock data...</h3>
          <p>Please wait, items are loading from database.</p>
        </div>
      </section>
    );
  }
  return (
    <section className={`bulk-shell ${cart.length ? "has-cart" : ""}`}>
      <div className="bulk-layout">
        <aside className="bulk-sidebar">
          <div className="step-heading">
            <span>1</span> Select Category
          </div>
          <div className="category-card-list">
            {catalog.map((category) => (
              <button
                key={category.id}
                className={`category-card ${category.id === activeCategoryId ? "active" : ""}`}
                onClick={() => selectCategory(category.id)}
              >
                <span className="category-icon">
                  <PackageCheck size={20} />
                </span>
                <span>{category.label}</span>
              </button>
            ))}
          </div>

          <div className="series-block">
            <div className="step-heading">
              <span>2</span> Select{" "}
              {GROUP_LABELS[activeCategory?.id] || "Series"}
            </div>
            <div className="series-chip-list">
              {activeGroups.length ? (
                activeGroups.map((group) => (
                  <button
                    key={group.key}
                    className={group.key === activeGroupKey ? "active" : ""}
                    onClick={() => selectGroup(group.key)}
                  >
                    {group.uiToken || group.label}
                  </button>
                ))
              ) : (
                <p className="no-series">No series found.</p>
              )}
            </div>
          </div>

          {!!subSeriesOptions.length && (
            <div className="series-block sub-series-block">
              <div className="step-heading">
                <span>2.1</span> Select Sub Series
              </div>
              <div className="series-chip-list compact-chip-list">
                {subSeriesOptions.map((sub) => (
                  <button
                    key={sub}
                    className={sub === activeSubSeries ? "active" : ""}
                    onClick={() => {
                      setActiveSubSeries(sub);
                      setSearch("");
                      setResults(null);
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="items-panel">
          <div className="items-toolbar">
            <div>
              <div className="step-heading">
                <span>3</span> Select Item Code
              </div>
              <p>
                {activeCategory?.label}{" "}
                {activeGroup
                  ? `• ${activeGroup.uiToken || activeGroup.label}`
                  : ""}{" "}
                {activeSubSeries ? `• ${activeSubSeries}` : ""}
              </p>
            </div>
            <label className="bulk-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search item code"
              />
            </label>
          </div>

          {error && <div className="bulk-error">{error}</div>}

          <div className="item-tile-grid">
            {visibleItems.map((item) => {
              const selected = selectedItem(cart, item.productCode);
              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={`item-code-tile ${item.uiMeta ? "has-meta" : ""} ${selected ? "selected expanded" : ""}`}
                  key={item.productCode}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                >
                  <div className="item-tile-main">
                    <strong>{item.uiCode}</strong>
                    {item.uiMeta && (
                      <span className="item-meta-badge">{item.uiMeta}</span>
                    )}
                  </div>

                  {selected && (
                    <div
                      className="tile-qty-box"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {/* <span className="qty-stepper compact-stepper">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => adjustQty(item.productCode, -1)}
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={selected.requestedQty}
                          onChange={(event) =>
                            setCartQty(item.productCode, event.target.value)
                          }
                        />
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => adjustQty(item.productCode, 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </span>
                      <button
                        className="tile-delete"
                        type="button"
                        aria-label="Remove item"
                        onClick={() => removeItem(item.productCode)}
                      >
                        <Trash2 size={13} />
                      </button> */}

                      <div className="tile-input-row">
                        <input
                          className="tile-qty-input"
                          type="number"
                          min="1"
                          value={selected.requestedQty}
                          onChange={(event) =>
                            setCartQty(item.productCode, event.target.value)
                          }
                        />

                        <button
                          className="tile-delete"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeItem(item.productCode);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!visibleItems.length && (
            <div className="empty-cart no-items">
              No item codes found in this series.
            </div>
          )}
        </main>

        <aside
          className={`cart-panel ${cart.length ? "has-items" : "is-empty"}`}
        >
          <div
            className="cart-title"
            role={cart.length ? "button" : undefined}
            tabIndex={cart.length ? 0 : undefined}
            onClick={() => cart.length && setCartPreviewOpen(true)}
            onKeyDown={(event) => {
              if (!cart.length) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setCartPreviewOpen(true);
              }
            }}
          >
            <ShoppingCart size={18} />
            <div>
              <h3>Selected Items</h3>
              <p>{cart.length} total</p>
            </div>
            {!!cart.length && (
              <span className="cart-count-badge">{cart.length}</span>
            )}
            <button
              className="cart-reset-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                resetBulk();
              }}
              disabled={!cart.length && !results}
            >
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          {!cart.length ? (
            <div className="empty-cart">
              Item code select karo. Quantity selected item ke andar hi add
              hogi.
            </div>
          ) : (
            <>
              <div
                className={`cart-list ${mobileCartOpen ? "mobile-open" : ""}`}
              >
                {cart.map((item) => (
                  <div className="cart-row" key={item.productCode}>
                    <div>
                      <strong>{item.displayCode}</strong>
                      <span>{item.displayMeta || item.categoryName}</span>
                    </div>
                    <div
                      className="qty-stepper"
                      aria-label={`${item.displayCode} quantity`}
                    >
                      <button
                        type="button"
                        onClick={() => adjustQty(item.productCode, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.requestedQty}
                        onChange={(event) =>
                          setCartQty(item.productCode, event.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => adjustQty(item.productCode, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      className="remove-item"
                      onClick={() => removeItem(item.productCode)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {cart.length > 0 && (
            <button
              className="check-stock-main"
              disabled={loading}
              onClick={openReview}
            >
              {loading ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Search size={18} />
              )}
              Check Stock ({cart.length} {cart.length === 1 ? "Item" : "Items"})
            </button>
          )}

          {cart.length > 0 && (
            <small className="privacy-note">We never store your data.</small>
          )}
        </aside>
      </div>

      {cartPreviewOpen && (
        <div
          className="cart-preview-backdrop"
          onClick={() => setCartPreviewOpen(false)}
        >
          <div
            className="cart-preview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-preview-header">
              <div>
                <h3>Selected Items</h3>
                <p>
                  {cart.length} {cart.length === 1 ? "item" : "items"} selected
                </p>
              </div>
              <button
                type="button"
                className="cart-preview-close"
                onClick={() => setCartPreviewOpen(false)}
                aria-label="Close selected items"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cart-preview-list">
              {cart.map((item) => (
                <div className="cart-row" key={item.productCode}>
                  <div>
                    <strong>{item.displayCode}</strong>
                    <span>{item.displayMeta || item.categoryName}</span>
                  </div>

                  <div
                    className="qty-stepper"
                    aria-label={`${item.displayCode} quantity`}
                  >
                    <button
                      type="button"
                      onClick={() => adjustQty(item.productCode, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.requestedQty}
                      onChange={(event) =>
                        setCartQty(item.productCode, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => adjustQty(item.productCode, 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    className="remove-item"
                    type="button"
                    onClick={() => removeItem(item.productCode)}
                    aria-label="Remove item"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="check-stock-main"
              disabled={loading || !canCheck}
              onClick={() => {
                setCartPreviewOpen(false);
                openReview();
              }}
            >
              {loading ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Search size={18} />
              )}
              Check Stock ({cart.length} {cart.length === 1 ? "Item" : "Items"})
            </button>
          </div>
        </div>
      )}

      {reviewMode && (
        <div className="modal-backdrop">
          <div className="review-modal">
            <div className="review-icon">
              <ClipboardCheck size={26} />
            </div>
            <h3>Confirm stock check?</h3>
            <p>Please confirm selected items before checking stock.</p>
            <div className="review-list">
              {cart.map((item) => (
                <div className="review-row" key={item.productCode}>
                  <div>
                    <strong>{item.displayCode}</strong>
                    <span>{item.displayMeta || item.categoryName}</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={item.requestedQty}
                    onChange={(event) =>
                      setCartQty(item.productCode, event.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.productCode)}
                    aria-label="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="ghost-btn"
                onClick={() => setReviewMode(false)}
              >
                Edit Items
              </button>
              <button
                className="check-stock-main"
                onClick={confirmCheckStock}
                disabled={loading || !canCheck}
              >
                {loading ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <PackageCheck size={18} />
                )}
                Confirm Check
              </button>
            </div>
          </div>
        </div>
      )}

      {results && (
        <section className="bulk-results" ref={resultsRef}>
          <div className="result-title-row">
            <div>
              <h3>Stock Check Results</h3>
              {/* <p>
                Available items left side me, not available / short stock right
                side me.
              </p> */}
            </div>
            <span>Just now</span>
          </div>

          <div className="result-columns">
            <div className="result-column available-result">
              <h3>
                <CheckCircle2 size={20} /> Available Items (
                {availableResults.length})
              </h3>
              {availableResults.length ? (
                availableResults.map((item) => (
                  <div
                    className="result-row"
                    key={item.productCode || item.displayCode}
                  >
                    <strong>{item.displayCode || item.productCode}</strong>
                    <span>Required: {item.requestedQty} PCS</span>
                    <small>
                      Current: {item.stockQty || item.requestedQty}{" "}
                      {item.stockUnit || "PCS"}
                    </small>
                  </div>
                ))
              ) : (
                <div className="empty-cart">No fully available items.</div>
              )}
            </div>

            <div className="result-column not-result">
              <h3>
                <XCircle size={20} /> Short / Not Available (
                {notAvailableResults.length})
              </h3>
              {notAvailableResults.length ? (
                notAvailableResults.map((item) => (
                  <div
                    className="result-row"
                    key={item.productCode || item.displayCode}
                  >
                    <strong>{item.displayCode || item.productCode}</strong>
                    <span>Required: {item.requestedQty} PCS</span>
                    <small>
                      Current: {item.stockQty || 0} {item.stockUnit || "PCS"}
                    </small>
                  </div>
                ))
              ) : (
                <div className="empty-cart">
                  All selected items are available.
                </div>
              )}
            </div>
          </div>

          <div className="transport-order-box">
            <label>
              <span>Transport Name</span>
              <input
                value={transportName}
                onChange={(event) => setTransportName(event.target.value)}
                placeholder="Enter transport name"
              />
            </label>
            {/* <p>Client name will be saved automatically as {authUser?.name || "logged-in user"}.</p> */}
          </div>

          <div className="result-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={downloadResults}
            >
              <Download size={17} /> Download Report
            </button>
            <button
              className="send-order-btn"
              type="button"
              disabled={orderSaving || !transportName.trim()}
              onClick={sendBulkOrder}
            >
              {orderSaving ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <MessageCircle size={18} />
              )}
              Save & Send Order via WhatsApp
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
