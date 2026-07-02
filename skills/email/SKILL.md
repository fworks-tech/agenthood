---
name: email
description: Send emails via SMTP or sendmail. Use when sending transactional emails or notifications programmatically.
metadata:
  category: messaging
  dependencies:
    cli: sendmail
    checkCommand: which sendmail || which msmtp
    install:
      darwin: { brew: msmtp }
      linux: { apt: msmtp }
  config:
    - name: SMTP_HOST
      label: SMTP Server
      type: string
      required: false
    - name: SMTP_PORT
      label: SMTP Port
      type: string
      required: false
---

# Email

Send emails via command line.

## Using sendmail/msmtp

- Send email: `echo "Body" | sendmail recipient@example.com`
- With subject: `echo -e "Subject: Hello\n\nBody text" | sendmail -t recipient@example.com`

## Using SMTP with curl

```
curl --url "smtps://${SMTP_HOST}:${SMTP_PORT}" \
  --mail-from "sender@example.com" \
  --mail-rcpt "recipient@example.com" \
  --user "${SMTP_USER}:${SMTP_PASS}" \
  --upload-file email.txt
```

## email.txt format
```
From: Sender <sender@example.com>
To: Recipient <recipient@example.com>
Subject: Subject line
Content-Type: text/plain; charset=utf-8

Body text here.
```

## Notes
- Configure msmtp at `~/.msmtprc`
- Never hardcode SMTP credentials in scripts
