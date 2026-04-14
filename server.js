// Crypto Watchlist Global – Telegram Stars Bot
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
const SUBSCRIPTION_PERIOD = 2592000; // 30 days

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

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
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
  await tg("sendMessage", {
    chat_id: chatId,
    text:
`🚀 Crypto Watchlist Global

Premium includes:
High-probability trade setups based on pure price action, market structure, and liquidity — no noise, no guessing.

📊 Intraday & swing setups
⚡️ Real-time market reactions
🎯 Clear entries, stops, and targets

Price: ⭐ ${PRICE_STARS} Stars / 30 days

Educational content only. Not financial advice.`,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 Get Premium Access", callback_data: "buy_premium" }]
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
      inline_keyboard: [
        [{ text: `Pay ⭐ ${PRICE_STARS}`, url: invoiceLink }]
      ]
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

    await tg("answerCallbackQuery", {
      callback_query_id: cq.id
    });

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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return jsonResponse(res, 200, { ok: true });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/") {
      return jsonResponse(res, 200, {
        ok: true,
        service: "Crypto Watchlist Global Bot"
      });
    }

    if (req.method === "POST" && url.pathname === "/create-invoice") {
      const body = await readBody(req);
      const userId = body.userId || "webapp";
      const invoiceLink = await createInvoiceLink(userId);

      return jsonResponse(res, 200, {
        ok: true,
        invoiceLink
      });
    }

    if (req.method === "POST" && url.pathname === `/webhook/${WEBHOOK_SECRET}`) {
      const update = await readBody(req);
      handleUpdate(update).catch(console.error);

      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 404, {
      ok: false,
      error: "Not found"
    });
  } catch (err) {
    console.error(err);
    return jsonResponse(res, 500, {
      ok: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
