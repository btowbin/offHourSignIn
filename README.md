# Off-Hours Lab Sign-In Bot

A Telegram bot backed by Google Apps Script and Google Sheets for recording off-hours lab visits. Users interact with the bot privately; a configured safety group receives an alert when someone misses their planned checkout time.

## Features

- Private check-in, checkout, extension, and status commands
- Persistent Telegram reply keyboard for common actions
- `Other` guidance for custom durations
- Custom durations in minutes or decimal hours, such as `/in 45m` or `/extend 1.5h`
- Private reminder before planned checkout
- Safety-group alert after a configurable grace period
- Google Sheets audit trail
- Script locking to reduce duplicate processing when triggers overlap
- No credentials or deployment-specific IDs stored in source control

## Files

- `Code.gs` — complete Apps Script bot
- `appsscript.json` — Apps Script manifest
- `SETUP.md` — step-by-step installation and configuration
- `USAGE.md` — commands and operating behavior
- `SECURITY.md` — credential-handling guidance

## Quick start

1. Create a Telegram bot using [BotFather](https://t.me/BotFather).
2. Create a Google Sheet and an Apps Script project.
3. Copy `Code.gs` and `appsscript.json` into the Apps Script project, or upload them with `clasp`.
4. Add the required values as **Script Properties**, never directly in the code.
5. Set the Apps Script time zone, run `initializeSheet()`, and authorize the project.
6. Add one-minute time-driven triggers for `pollTelegram` and `checkOverdue`.
7. Run the tests described in [SETUP.md](SETUP.md), then send `/start` to the bot.

See [SETUP.md](SETUP.md) for the full procedure.

## Configuration summary

| Script Property | Required | Description | Default |
| --- | --- | --- | --- |
| `BOT_TOKEN` | Yes | Telegram bot token from BotFather | — |
| `GROUP_CHAT_ID` | Yes | Group or channel ID for overdue alerts | — |
| `SPREADSHEET_ID` | Only for standalone scripts | ID from the Google Sheet URL | Active bound Sheet |
| `SHEET_NAME` | No | Worksheet used for records | `OffHourCheckIn` |
| `REMINDER_BEFORE_MIN` | No | Minutes before checkout to remind the user | `15` |
| `ALERT_AFTER_MIN` | No | Minutes after checkout before alerting the group | `15` |

`TELEGRAM_OFFSET` is maintained automatically by the bot. Do not set it during a normal installation.

## Data stored

The Sheet stores the Telegram user ID, display name, username, check-in time, planned checkout, actual checkout, and reminder/alert state. Limit access to the Sheet according to your lab's privacy and safety policies.

## Disclaimer

This is a coordination aid, not a substitute for institutional lone-working procedures, emergency systems, or active supervision. Test the full alert path before relying on it.
