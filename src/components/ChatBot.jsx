import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ExternalLink,
  Headphones,
  Loader2,
  MessageCircle,
  PackageSearch,
  Send,
  UserRound,
} from "lucide-react";
import {
  buildHelpDeskLink,
  checkAvailability,
  checkStock,
  checkStockBatches,
  getCategoryById,
  PRODUCT_CATEGORIES,
} from "../api/client.js";
import { cleanText, isPositiveNumber } from "../utils/validators.js";

const START_OPTIONS = [
  { id: "check_stock", label: "Check Stock", icon: PackageSearch },
];

const AFTER_HELP_OPTIONS = [
  { id: "check_stock", label: "Check Another Item", icon: PackageSearch },
  { id: "help_desk", label: "Connect Help Desk", icon: Headphones },
];

const UNIT_OPTIONS = ["PCS", "BOX"];

function cleanCompanyContext(value = "") {
  return String(value || "")
    .replace(
      /\s*\[[^\]]*(?:Orange Profile|Best Moulding|Louvers|Acrylic|Laminate|ASA|Paintable)[^\]]*\]\s*/gi,
      " ",
    )
    .replace(
      /\s*\([^)]*(?:Orange Profile|Best Moulding|Louvers|Acrylic|Laminate|ASA|Paintable)[^)]*\)\s*/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanFeetText(value = "") {
  const text = cleanCompanyContext(value);

  if (/9\.5\s*(?:ft|feet)/i.test(text) || /95\s*(?:ft|feet)/i.test(text)) {
    return "9.5 Feet";
  }

  if (/\b8\s*(?:ft|feet)\b/i.test(text) || /\b8FT\b/i.test(text)) {
    return "8 Feet";
  }

  return text;
}

function isWSeriesProduct(value = "") {
  const text = cleanCompanyContext(value).toUpperCase();
  const clean = text.replace(/[^A-Z0-9]/g, "");
  return /^W\d+/.test(clean) || /\bW[\s-]?\d+/.test(text);
}

function getFastCheckItemName(item = {}) {
  const productCode = cleanCompanyContext(item.productCode || "");
  const tallyName = cleanCompanyContext(
    item.tallyStockName ||
      item.stockName ||
      item.name ||
      item.productName ||
      "",
  );
  const displayCode = cleanCompanyContext(item.displayCode || "");
  const label = cleanCompanyContext(item.label || "");

  // Feet variants me sirf clean feet text dikhana hai.
  const feetSource = label || tallyName || productCode || displayCode;
  if (
    /9\.5\s*(?:ft|feet)/i.test(feetSource) ||
    /95\s*(?:ft|feet)/i.test(feetSource)
  ) {
    return "9.5 Feet";
  }
  if (/\b8\s*(?:ft|feet)\b/i.test(feetSource) || /\b8FT\b/i.test(feetSource)) {
    return "8 Feet";
  }

  // W series / Paintable me duplicate label use nahi karna.
  // Backend productCode/tallyStockName me exact variant hota hai: W-202, W-202-B1, W-202-B2.
  if (
    isWSeriesProduct(productCode) ||
    isWSeriesProduct(tallyName) ||
    isWSeriesProduct(displayCode) ||
    isWSeriesProduct(label)
  ) {
    return productCode || tallyName || displayCode || label || "Item";
  }

  return displayCode || productCode || tallyName || label || "Item";
}

function normalizeOptionKey(value = "") {
  return cleanCompanyContext(value)
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "");
}

function getVariantOptions(variants = []) {
  const seen = new Set();

  return (variants || [])
    .map((variant, index) => {
      const label = getFastCheckItemName(variant);
      return {
        value: `VARIANT_${index}`,
        label,
        key: normalizeOptionKey(
          label || variant.productCode || variant.label || index,
        ),
      };
    })
    .filter((option) => {
      if (!option.key) return false;
      if (seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    });
}

function cleanBatchCode(value = "") {
  return cleanFeetText(value);
}

// const STOCK_ACTION_OPTIONS = [
//   { value: "CHECK_QTY", label: "Check Quantity" },
//   { value: "SHOW_BATCHES", label: "Show Batch Codes" },
// ];

const STOCK_ACTION_OPTIONS = [
  { value: "SHOW_BATCHES", label: "Show Batch Codes" },
  { value: "STOCK_DONE", label: "No, It's Done" },
];

const DONE_ONLY_OPTIONS = [{ value: "STOCK_DONE", label: "No, It's Done" }];

function formatTotalStock(stock) {
  const quantityText =
    stock?.quantityText ||
    `${Number(stock?.stockQty || 0)} ${stock?.stockUnit || "PCS"}`;

  const itemName = getFastCheckItemName(stock);
  return `Item found: ${itemName}\nTotal Available Stock: ${quantityText}`;
}

function formatBatchMessage(result) {
  if (!result?.batches?.length) {
    return `No positive stock batch codes found for ${getFastCheckItemName(result)}.`;
  }

  const totalQty = result.batches.reduce((sum, batch) => {
    return sum + Number(batch.stockQty || 0);
  }, 0);

  const stockUnit = result.batches[0]?.stockUnit || "Nos.";
  const totalQuantityText = `${totalQty} ${stockUnit}`;

  const lines = result.batches.map((batch, index) => {
    const batchCode = cleanBatchCode(batch.batchCode);
    return `${index + 1}. ${batchCode} — ${
      batch.quantityText || `${batch.stockQty} ${batch.stockUnit || stockUnit}`
    }`;
  });

  return `Batch codes for ${getFastCheckItemName(result)}:\n\nTotal Quantity: ${totalQuantityText}\n\n${lines.join("\n")}`;
}

function botMessage(text, extra = {}) {
  return {
    id: crypto.randomUUID(),
    sender: "bot",
    text,
    time: new Date(),
    ...extra,
  };
}

function userMessage(text) {
  return { id: crypto.randomUUID(), sender: "user", text, time: new Date() };
}

const initialMessages = [
  botMessage("Welcome to Stock Help Desk 👋"),
  botMessage("Please tap below to check stock availability.", {
    options: START_OPTIONS,
  }),
];

export default function ChatBot() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [step, setStep] = useState("idle");
  const [loading, setLoading] = useState(false);
  const [lastStock, setLastStock] = useState(null);
  const [inquiryDraft, setInquiryDraft] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [wrongCodeCount, setWrongCodeCount] = useState(0);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function push(...items) {
    setMessages((prev) => [...prev, ...items]);
  }

  function resetChat() {
    setMessages(initialMessages);
    setStep("idle");
    setInput("");
    setLastStock(null);
    setInquiryDraft({});
    setSelectedCategory(null);
    setWrongCodeCount(0);
  }

  function showStockActionOptions(stock) {
    const canShowBatches =
      stock?.hasBatches === true &&
      String(stock?.categoryName || "").toLowerCase() === "louvers";

    push(
      botMessage(formatTotalStock(stock), {
        stock: {
          productCode: getFastCheckItemName(stock),
          quantityText:
            stock.quantityText ||
            `${Number(stock.stockQty || 0)} ${stock.stockUnit || "PCS"}`,
          stockStatus:
            Number(stock.stockQty || 0) > 0 ? "Available" : "Not Available",
        },
      }),
      botMessage(
        canShowBatches
          ? "Would you like to see batch-wise stock details?"
          : "Stock quantity shown above. Anything else?",
        {
          customOptions: canShowBatches
            ? STOCK_ACTION_OPTIONS
            : DONE_ONLY_OPTIONS,
        },
      ),
    );

    setStep("awaiting_stock_action");
  }

  function showHelpDesk(productCode = "") {
    const link = buildHelpDeskLink(productCode);
    push(
      botMessage("Please tap below to connect our help desk.", {
        link,
        linkLabel: "Connect Help Desk",
      }),
    );
  }

  async function handleOption(optionId) {
    if (optionId === "check_stock") {
      push(
        userMessage("Check Stock"),
        botMessage("Please select product category.", {
          customOptions: PRODUCT_CATEGORIES.map((category) => ({
            value: `CATEGORY_${category.id}`,
            label: category.label,
          })),
        }),
      );
      setStep("awaiting_category");
      return;
    }

    if (optionId === "help_desk") {
      push(userMessage("Connect Help Desk"));
      showHelpDesk(lastStock?.productCode || inquiryDraft.productCode || "");
      return;
    }

    if (optionId === "yes_more_help") {
      push(userMessage("Yes"));
      push(
        botMessage("Sure. Kindly select the below option.", {
          options: AFTER_HELP_OPTIONS,
        }),
      );
      setStep("idle");
      return;
    }

    if (optionId === "no_more_help") {
      push(userMessage("No"));
      push(botMessage("Thank you for contacting us! Have a great day."));
      setStep("idle");
    }
  }

  async function handleStockCode(code) {
    const productCode = cleanText(code).toUpperCase();
    if (!productCode) {
      push(botMessage("Please enter a valid item code."));
      return;
    }

    push(userMessage(productCode));
    setLoading(true);

    try {
      const stock = await checkStock(productCode, selectedCategory || {});
      setLastStock(stock);

      if (stock.needsVariantSelection) {
        setWrongCodeCount(0);
        push(
          botMessage("This item has multiple sizes. Please select item size.", {
            customOptions: getVariantOptions(stock.variants),
          }),
        );
        setStep("awaiting_variant");
        return;
      }

      if (stock.stockStatus === "Item Not Found") {
        const nextWrongCount = wrongCodeCount + 1;
        setWrongCodeCount(nextWrongCount);

        if (nextWrongCount >= 2) {
          push(
            botMessage(
              "I thing their is Error in the item code, for further assistance, please tap the below option to connect our help desk.",
              {
                link: buildHelpDeskLink(productCode),
                linkLabel: "Connect Help Desk",
              },
            ),
          );
          setStep("idle");
          return;
        }

        push(
          botMessage(
            `${productCode} item not found. Please check item code and try again.`,
          ),
        );
        setStep("awaiting_stock_code");
        return;
      }

      setWrongCodeCount(0);
      setInquiryDraft({
        productCode: stock.productCode,
        categoryId: selectedCategory?.id || "",
        companyName: stock.companyName || selectedCategory?.companyName || "",
        categoryName:
          stock.categoryName || selectedCategory?.categoryName || "",
        godownName: stock.godownName || "",
      });
      setLastStock(stock);
      showStockActionOptions(stock);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuantity(value) {
    const text = cleanText(value);
    if (!isPositiveNumber(text)) {
      push(botMessage("Please enter valid quantity number. Example: 10"));
      return;
    }

    const requestedQty = Number(text);
    const draft = { ...inquiryDraft, requestedQty };
    setInquiryDraft(draft);
    push(userMessage(text));

    setLoading(true);

    try {
      const result = await checkAvailability(draft);
      const suffix = result.isMock
        ? "\n\nNote: Backend not connected, mock data is showing for frontend demo."
        : "";

      push(
        botMessage(
          `${result.responseMessage || "Stock inquiry completed."}${suffix}`,
          {
            stock: {
              productCode: result.productCode,
              quantityText:
                result.requestedUnit === "BOX"
                  ? `${result.requestedQty} BOX requested`
                  : `${result.requestedQty} PCS requested`,
              stockStatus: result.available ? "Available" : "Not Available",
            },
          },
        ),
        botMessage("Is there anything I can do for you?", {
          options: [
            { id: "yes_more_help", label: "Yes", icon: MessageCircle },
            { id: "no_more_help", label: "No", icon: CheckCircle2 },
          ],
        }),
      );

      setStep("idle");
    } finally {
      setLoading(false);
    }
  }

  async function handleCustomOption(value) {
    if (String(value).startsWith("CATEGORY_")) {
      const categoryId = String(value).replace("CATEGORY_", "");
      const category = getCategoryById(categoryId);

      if (!category) {
        push(botMessage("Please select a valid category."));
        return;
      }

      setSelectedCategory(category);
      push(
        userMessage(category.label),
        botMessage(
          category.id === "louvers"
            ? "Please enter louver item code. Example: L01-BL-13"
            : category.id === "asa_sheet"
              ? "Please enter ASA code. Example: OSAG-01 or OSAG01"
              : category.id === "acrylic_sheet"
                ? "Please enter Acrylic code. Example: D-02, D02, G-20"
                : category.id === "laminate_sheet"
                  ? "Please enter Laminate code. Example: HGL-3020 or HGL3020"
                  : "Please enter Paintable item code.",
        ),
      );
      setStep("awaiting_stock_code");
      return;
    }
    if (String(value).startsWith("VARIANT_")) {
      const index = Number(String(value).replace("VARIANT_", ""));
      const selectedVariant = lastStock?.variants?.[index];

      if (!selectedVariant) {
        push(botMessage("Please select a valid item size."));
        return;
      }

      push(userMessage(getFastCheckItemName(selectedVariant)));

      setLastStock(selectedVariant);
      setInquiryDraft({
        productCode: selectedVariant.productCode,
        categoryId: selectedCategory?.id || "",
        companyName:
          selectedVariant.companyName || selectedCategory?.companyName || "",
        categoryName:
          selectedVariant.categoryName || selectedCategory?.categoryName || "",
        godownName: selectedVariant.godownName || "",
      });

      showStockActionOptions(selectedVariant);
      return;
    }

    // if (value === "CHECK_QTY") {
    //   push(userMessage("Check Quantity"));

    //   push(
    //     botMessage("Kindly select the below option", {
    //       customOptions: UNIT_OPTIONS.map((unit) => ({
    //         value: `UNIT_${unit}`,
    //         label: unit,
    //       })),
    //     }),
    //   );

    //   setStep("awaiting_unit");
    //   return;
    // }

    if (value === "STOCK_DONE") {
      push(userMessage("No, It's Done"));

      push(
        botMessage("Is there anything I can do for you?", {
          options: [
            { id: "yes_more_help", label: "Yes", icon: MessageCircle },
            { id: "no_more_help", label: "No", icon: CheckCircle2 },
          ],
        }),
      );

      setStep("idle");
      return;
    }

    if (value === "SHOW_BATCHES") {
      const productCode = lastStock?.productCode || inquiryDraft.productCode;

      if (!productCode) {
        push(botMessage("Please select item first."));
        return;
      }

      push(userMessage("Show Batch Codes"));
      setLoading(true);

      try {
        const result = await checkStockBatches(lastStock || { productCode });

        push(
          botMessage(formatBatchMessage(result)),
          botMessage("Is there anything I can do for you?", {
            options: [
              { id: "yes_more_help", label: "Yes", icon: MessageCircle },
              { id: "no_more_help", label: "No", icon: CheckCircle2 },
            ],
          }),
        );

        setStep("idle");
      } catch (error) {
        push(
          botMessage("Sorry, batch codes could not be loaded right now."),
          botMessage("Is there anything I can do for you?", {
            options: [
              { id: "yes_more_help", label: "Yes", icon: MessageCircle },
              { id: "no_more_help", label: "No", icon: CheckCircle2 },
            ],
          }),
        );

        setStep("idle");
      } finally {
        setLoading(false);
      }

      return;
    }

    if (value === "UNIT_PCS" || value === "UNIT_BOX") {
      const unit = value.replace("UNIT_", "");
      push(userMessage(unit));
      setInquiryDraft((draft) => ({ ...draft, requestedUnit: unit }));
      setStep("awaiting_quantity");
      push(botMessage(`Please enter ${unit.toLowerCase()} quantity number.`));
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const text = cleanText(input);
    if (!text || loading) return;
    setInput("");

    if (step === "awaiting_stock_code") {
      await handleStockCode(text);
      return;
    }

    if (step === "awaiting_quantity") {
      await handleQuantity(text);
      return;
    }

    push(
      userMessage(text),
      botMessage("Please tap below to check stock availability.", {
        options: START_OPTIONS,
      }),
    );
  }

  return (
    <section className="chat-card">
      <div className="chat-header">
        <div className="avatar">
          <Bot size={22} />
        </div>
        <div>
          <h3>Stock Help Desk</h3>
          <p>Tally connected stock inquiry assistant</p>
        </div>
        <button className="reset-btn" onClick={resetChat}>
          <ArrowLeft size={16} /> Reset
        </button>
      </div>

      <div className="chat-body">
        {messages.map((msg) => (
          <div className={`msg-row ${msg.sender}`} key={msg.id}>
            <div className="msg-avatar">
              {msg.sender === "bot" ? (
                <Bot size={15} />
              ) : (
                <UserRound size={15} />
              )}
            </div>
            <div className="bubble-wrap">
              <div className="bubble">
                <p>{msg.text}</p>

                {msg.stock && (
                  <div
                    className={`stock-mini-card ${
                      msg.stock.stockStatus === "Not Available"
                        ? "not-available"
                        : "available"
                    }`}
                  >
                    <CheckCircle2 size={17} />
                    <div>
                      <strong>{msg.stock.productCode}</strong>
                      <span>
                        {msg.stock.quantityText} • {msg.stock.stockStatus}
                      </span>
                    </div>
                  </div>
                )}

                {msg.link && (
                  <a
                    className="whatsapp-link"
                    href={msg.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {msg.linkLabel || "Open Link"} <ExternalLink size={15} />
                  </a>
                )}
              </div>

              {msg.options && (
                <div className="quick-options">
                  {msg.options.map((opt) => {
                    const Icon = opt.icon || MessageCircle;
                    return (
                      <button key={opt.id} onClick={() => handleOption(opt.id)}>
                        <Icon size={16} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {msg.customOptions && (
                <div className="quick-options">
                  {msg.customOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleCustomOption(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg-row bot">
            <div className="msg-avatar">
              <Bot size={15} />
            </div>
            <div className="bubble loading-bubble">
              <Loader2 size={18} className="spin" /> Processing...
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <form className="chat-input" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            step === "awaiting_stock_code"
              ? "Enter stock item code..."
              : step === "awaiting_quantity"
                ? "Enter quantity..."
                : "Tap Check Stock to start..."
          }
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          <Send size={19} />
        </button>
      </form>
    </section>
  );
}
