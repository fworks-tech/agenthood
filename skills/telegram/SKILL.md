---
name: telegram
description: Send messages and manage Telegram bots via the Bot API. Use when sending notifications or building chat interactions.
metadata:
  category: messaging
  config:
    - name: TELEGRAM_BOT_TOKEN
      label: Bot Token
      type: secret
      required: true
    - name: TELEGRAM_CHAT_ID
      label: Chat ID
      type: string
      required: true
---

# Telegram Bot API

Use the Telegram Bot API to send messages and manage bots.

## API Base
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/
```

## Common Operations

### Messaging
- Send message: `curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=Hello"`
- Send with formatting: `curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=*Bold* _italic_" -d "parse_mode=Markdown"`

### Bot Info
- Get updates: `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates"`
- Get bot info: `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"`

## Notes
- Bot token from @BotFather on Telegram
- Chat ID can be found via `getUpdates` after sending a message to the bot
