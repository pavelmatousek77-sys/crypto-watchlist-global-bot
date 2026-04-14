# Crypto Watchlist Global – Telegram Stars Bot

Diese Mini-App verkauft Premium-Zugang mit Telegram Stars und sendet nach erfolgreicher Zahlung einen einmaligen Einladungslink zu deinem privaten Kanal.

## 1. Wichtige Zugangsdaten

Du brauchst:

- `BOT_TOKEN` von BotFather
- `CHANNEL_ID` deines privaten Kanals
- `PUBLIC_URL` deiner Hosting-URL, z.B. `https://crypto-watchlist-global.onrender.com`
- `WEBHOOK_SECRET`, frei wählbar, z.B. `cwg-secret-2026`

Wichtig: Den Bot-Token nie öffentlich posten.

## 2. Render Deployment

1. Gehe zu https://render.com
2. New → Web Service
3. ZIP/Repository hochladen oder GitHub verbinden
4. Start command:
   `npm start`
5. Environment Variables setzen:

```text
BOT_TOKEN=dein_neuer_bot_token
CHANNEL_ID=-100xxxxxxxxxx
PUBLIC_URL=https://deine-render-url.onrender.com
WEBHOOK_SECRET=ein-geheimes-wort
PRICE_STARS=999
```

## 3. Webhook setzen

Nach dem Deployment diese URL im Browser öffnen, aber mit deinen echten Werten:

```text
https://api.telegram.org/botDEIN_BOT_TOKEN/setWebhook?url=https://deine-render-url.onrender.com/webhook/DEIN_WEBHOOK_SECRET
```

Wenn Telegram `{"ok":true}` meldet, ist der Webhook gesetzt.

## 4. Mini-App URL bei BotFather

Bei BotFather als Web App URL eintragen:

```text
https://deine-render-url.onrender.com/app
```

## 5. Test

1. Deinen Bot öffnen
2. `/start`
3. `Open Premium Shop`
4. Zahlung mit Stars testen
5. Nach Zahlung sendet der Bot den privaten Einladungslink

## 6. Partnerprogramm

Wenn die Mini-App mit Stars-Zahlung funktioniert:

Mini-App Profil öffnen → Bearbeiten → Partnerprogramm → erstellen.

Empfehlung:

- Provision: 30 %
- Zeitraum: 12 Monate

## 7. Support-Befehl

Telegram verlangt für Stars-Zahlungen Support. Der Bot reagiert auf:

```text
/paysupport
```
