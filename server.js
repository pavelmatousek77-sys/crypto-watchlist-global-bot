// Crypto Watchlist Global – Telegram Stars Mini App + Bot
// Node.js 20+, no external packages required.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID; // private channel usually: -1001234567890
const PUBLIC_URL = process.env.PUBLIC_URL; // e.g. https://your-app.onrender.com
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "change-me";
const PRICE_STARS = Number(process.env.PRICE_STARS || 999);
const PRODUCT_TITLE = "Premium Access";
const PRODUCT_DESCRIPTION = "30 days access to Crypto Watchlist Global Premium.";
const SUBSCRIPTION_PERIOD = 2592000; // 30 days, required value for Telegram Stars subscriptions

if (!BOT_TOKEN) console.warn("Missing BOT_TOKEN environment variable.");
if (!CHANNEL_ID) console.warn("Missing CHANNEL_ID environment variable.");
if (!PUBLIC_URL) console.warn("Missing PUBLIC_URL environment variable.");

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const dbPath = path.join(__dirname, "db.json");

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch {
    return { users: {}, payments: [] };
  }
}

function saveDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

async function tg(method, data) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data || {})
  });
  const json = await res.json();
  if (!json.ok) {
    console.error("Telegram API error", method, json);
    throw new Error(json.description || "Telegram API error");
  }
  return json.result;
}

function jsonResponse(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(body);
}

function htmlResponse(res, html) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
  });
}

async function createInvoiceLink(userId) {
  const payload = `premium:${userId}:${Date.now()}:${crypto.randomBytes(4).toString("hex")}`;
  return await tg("createInvoiceLink", {
    title: PRODUCT_TITLE,
    description: PRODUCT_DESCRIPTION,
    payload,
    provider_token: "",
    currency: "XTR",
    prices: [{ label: "Monthly premium access", amount: PRICE_STARS }],
    subscription_period: SUBSCRIPTION_PERIOD
  });
}

async function sendStart(chatId) {
  const appUrl = `${PUBLIC_URL}/app`;
  await tg("sendMessage", {
    chat_id: chatId,
    text:
`🚀 Crypto Watchlist Global

Premium includes:
• Daily BTC/ETH market updates
• Altcoin watchlists
• Support & resistance zones
• Setup ideas and risk notes

Price: ⭐ ${PRICE_STARS} Stars / 30 days

Educational content only. Not financial advice.`,
 reply_markup: {
  inline_keyboard: [
    [{ text: "Open Premium Shop", web_app: { url: appUrl } }],
    [{ text: "Buy Premium Access", callback_data: "buy_premium" }]
  ]
}
  });
}

async function sendInvoiceButton(chatId, userId) {
  const invoiceLink = await createInvoiceLink(userId);
  await tg("sendMessage", {
    chat_id: chatId,
    text: `⭐ Premium Access\n\nPrice: ${PRICE_STARS} Stars / 30 days\n\nTap below to subscribe.`,
    reply_markup: {
      inline_keyboard: [[{ text: `Pay ⭐ ${PRICE_STARS}`, url: invoiceLink }]]
    }
  });
}

async function handleSuccessfulPayment(message) {
  const payment = message.successful_payment;
  const userId = message.from.id;
  const db = loadDb();

  const expiresAt =
    payment.subscription_expiration_date ||
    Math.floor(Date.now() / 1000) + SUBSCRIPTION_PERIOD;

  db.users[userId] = {
    telegram_id: userId,
    username: message.from.username || null,
    first_name: message.from.first_name || null,
    expires_at: expiresAt,
    last_payment_charge_id: payment.telegram_payment_charge_id,
    updated_at: new Date().toISOString()
  };

  db.payments.push({
    telegram_id: userId,
    amount: payment.total_amount,
    currency: payment.currency,
    payload: payment.invoice_payload,
    telegram_payment_charge_id: payment.telegram_payment_charge_id,
    subscription_expiration_date: payment.subscription_expiration_date || null,
    is_recurring: !!payment.is_recurring,
    is_first_recurring: !!payment.is_first_recurring,
    created_at: new Date().toISOString()
  });

  saveDb(db);

  const expireDate = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const invite = await tg("createChatInviteLink", {
    chat_id: CHANNEL_ID,
    name: `paid-${userId}`,
    expire_date: expireDate,
    member_limit: 1
  });

  await tg("sendMessage", {
    chat_id: userId,
    text:
`✅ Payment received.

Your Premium access is active.

Join here:
${invite.invite_link}

This invite link is valid for 24 hours and can be used once.`
  });
}

async function handleUpdate(update) {
  if (update.pre_checkout_query) {
    await tg("answerPreCheckoutQuery", {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true
    });
    return;
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    await tg("answerCallbackQuery", { callback_query_id: cq.id });
    if (cq.data === "buy_premium") {
      await sendInvoiceButton(cq.message.chat.id, cq.from.id);
    }
    return;
  }

  const msg = update.message;
  if (!msg) return;

  if (msg.successful_payment) {
    await handleSuccessfulPayment(msg);
    return;
  }

  const text = (msg.text || "").trim();

  if (text.startsWith("/start")) {
    await sendStart(msg.chat.id);
    return;
  }

  if (text.startsWith("/buy")) {
    await sendInvoiceButton(msg.chat.id, msg.from.id);
    return;
  }

  if (text.startsWith("/paysupport")) {
    await tg("sendMessage", {
      chat_id: msg.chat.id,
      text: "Payment support: Please send your issue and payment date here. We will review it as soon as possible."
    });
    return;
  }

  await tg("sendMessage", {
    chat_id: msg.chat.id,
    text: "Use /start or /buy to get Premium Access."
  });
}

const miniAppHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <title>Crypto Watchlist Global</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: radial-gradient(circle at top, #12345a, #07111f 68%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 22px;
    }
    .card {
      width: 100%;
      max-width: 430px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 26px;
      padding: 28px;
      box-shadow: 0 22px 65px rgba(0,0,0,0.4);
    }
    h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.08; }
    p { color: #cbd8eb; line-height: 1.5; }
    .price { margin: 22px 0; font-size: 24px; font-weight: 800; color: #ffd166; }
    ul { text-align: left; color: #dbe7f7; line-height: 1.8; padding-left: 22px; }
    button {
      width: 100%;
      border: 0;
      border-radius: 16px;
      padding: 16px 18px;
      font-size: 17px;
      font-weight: 800;
      background: linear-gradient(135deg, #2fa8ff, #7c4dff);
      color: white;
      cursor: pointer;
    }
    .note { font-size: 12px; color: #93a7c1; margin-top: 16px; line-height: 1.4; }
    .status { margin-top: 14px; min-height: 20px; color: #aad7ff; font-size: 14px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Crypto Watchlist Global</h1>
    <p>Premium crypto market analysis for active traders.</p>
    <ul>
      <li>Daily BTC/ETH updates</li>
      <li>Altcoin watchlists</li>
      <li>Support & resistance zones</li>
      <li>Setup ideas and risk notes</li>
    </ul>
    <div class="price">⭐ ${PRICE_STARS} Stars / 30 days</div>
    <button id="buy">Get Premium Access</button>
    <div class="status" id="status"></div>
    <div class="note">Educational content only. Not financial advice.</div>
  </main>

  <script>
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const status = document.getElementById("status");
    const buyBtn = document.getElementById("buy");

    buyBtn.addEventListener("click", async () => {
      try {
        status.textContent = "Creating secure invoice...";
        const userId = tg?.initDataUnsafe?.user?.id || 0;

        const res = await fetch("/create-invoice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId })
        });

        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Could not create invoice.");

        status.textContent = "Opening Telegram payment...";
        if (tg?.openInvoice) {
          tg.openInvoice(data.invoiceLink, (paymentStatus) => {
            if (paymentStatus === "paid") {
              status.textContent = "Payment received. Check your Telegram chat for the invite link.";
            } else {
              status.textContent = "Payment not completed.";
            }
          });
        } else {
          window.location.href = data.invoiceLink;
        }
      } catch (err) {
        status.textContent = err.message || "Something went wrong.";
      }
    });
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return jsonResponse(res, 200, { ok: true });

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return jsonResponse(res, 200, { ok: true, service: "Crypto Watchlist Global Bot" });
    }

    if (req.method === "GET" && url.pathname === "/app") {
      return htmlResponse(res, miniAppHtml);
    }

    if (req.method === "POST" && url.pathname === "/create-invoice") {
      const body = await readBody(req);
      const userId = body.userId || "webapp";
      const invoiceLink = await createInvoiceLink(userId);
      return jsonResponse(res, 200, { ok: true, invoiceLink });
    }

    if (req.method === "POST" && url.pathname === `/webhook/${WEBHOOK_SECRET}`) {
      const update = await readBody(req);
      handleUpdate(update).catch(console.error);
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, { ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
