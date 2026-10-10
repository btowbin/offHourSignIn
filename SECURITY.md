# Security

## Secrets and deployment values

Do not commit Telegram bot tokens, chat IDs, spreadsheet IDs, passwords, API keys, Script IDs, OAuth credentials, or `.clasp.json` files.

Store runtime configuration in **Apps Script → Project Settings → Script Properties**. This repository intentionally contains property names and placeholders only.

If a Telegram token is exposed:

1. Revoke it with BotFather.
2. Generate a replacement.
3. Update the `BOT_TOKEN` Script Property.
4. Review Apps Script executions and Telegram activity.

## Access control and privacy

The Google Sheet contains names, Telegram identifiers, and attendance times. Share it only with authorized operators and follow applicable institutional privacy and retention requirements.

Keep the Apps Script project, its Script Properties, and the Telegram alert group restricted. Remove former operators from all three places.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal data, or exploitable details. Contact the repository owner privately and rotate any potentially exposed credential immediately.
