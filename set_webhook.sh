#!/usr/bin/env bash
# Usage:
# BOT_TOKEN=xxx PUBLIC_URL=https://your-app.onrender.com WEBHOOK_SECRET=secret ./set_webhook.sh

curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${PUBLIC_URL}/webhook/${WEBHOOK_SECRET}"
