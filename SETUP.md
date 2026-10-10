# Setup

## 1. Create the Telegram bot

1. Open [BotFather](https://t.me/BotFather) in Telegram.
2. Run `/newbot` and follow the prompts.
3. Copy the token somewhere secure. Do not paste it into `Code.gs` or commit it to Git.
4. Optionally use `/setcommands` and provide:

   ```text
   start - Show the check-in keyboard and help
   in - Check in with a duration, for example /in 2h
   out - Check out
   extend - Extend an open visit, for example /extend 30m
   status - Show the current check-in status
   help - Show help
   ```

## 2. Prepare the alert group

1. Create or choose a Telegram group for overdue safety alerts.
2. Add the bot to the group and allow it to send messages.
3. Determine the group's numeric chat ID. Telegram group IDs commonly begin with `-100`.
4. Keep the ID private even though it is not a password.

A channel can be used instead if one-way alerts are preferred, provided the bot is an administrator with permission to post.

## 3. Create the Google Sheet and Apps Script project

The simplest setup is a Sheet-bound script:

1. Create a Google Sheet.
2. Open **Extensions → Apps Script**.
3. Replace the editor contents with `Code.gs` from this repository.
4. Open **Project Settings**, enable viewing `appsscript.json`, and replace it with the repository version.
5. Change the manifest's `timeZone` from `Etc/UTC` to your lab's IANA time zone, such as `Europe/Zurich`.

For a standalone Apps Script project, also copy the spreadsheet ID from the Sheet URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## 4. Add Script Properties

In Apps Script, open **Project Settings → Script Properties → Add script property**.

Add the following without quotes:

| Property | Example placeholder |
| --- | --- |
| `BOT_TOKEN` | `YOUR_TELEGRAM_BOT_TOKEN` |
| `GROUP_CHAT_ID` | `YOUR_TELEGRAM_GROUP_CHAT_ID` |
| `SPREADSHEET_ID` | `YOUR_GOOGLE_SPREADSHEET_ID` (standalone scripts only) |
| `SHEET_NAME` | `OffHourCheckIn` (optional) |
| `REMINDER_BEFORE_MIN` | `15` (optional) |
| `ALERT_AFTER_MIN` | `15` (optional) |

Never add real values to repository files, examples, screenshots, issues, or logs.

## 5. Initialize and authorize

1. Select `initializeSheet` in the Apps Script function menu and run it once.
2. Approve the requested Google permissions.
3. Run `validateSetup`; the execution log should say the configuration is valid.
4. Run `testSheet`.
5. Run `testGroupMessage` and confirm the alert group receives the test message.

## 6. Create time-driven triggers

Open **Triggers → Add Trigger** and create both:

| Function | Event source | Timer | Recommended frequency |
| --- | --- | --- | --- |
| `pollTelegram` | Time-driven | Minutes timer | Every minute |
| `checkOverdue` | Time-driven | Minutes timer | Every minute |

Triggers run as the Google account that creates them. If project ownership or the operating account changes, recreate and test the triggers under the new account before deleting the old account's triggers.

## 7. End-to-end test

1. Send `/start` to the bot in a private chat.
2. Check in for a short test duration, for example `/in 2m`.
3. Confirm a new row appears in the Sheet.
4. Confirm the private reminder arrives.
5. Leave the test session open and confirm the overdue alert reaches the safety group.
6. Send `/out` and verify the checkout timestamp appears.
7. Restore the reminder and alert intervals to your operational values.

Trigger execution may add up to roughly one trigger interval of delay.

## Optional: deploy with clasp

Install and authenticate Google's Apps Script CLI, then create a local `.clasp.json` containing your Script ID. This file is ignored by Git because it is deployment-specific.

Typical commands are:

```text
clasp login
clasp clone YOUR_SCRIPT_ID
clasp push
```

Review changes before pushing, and continue to store credentials only in Script Properties.

## Troubleshooting

- **No private replies:** Confirm the user pressed **Start**, the `pollTelegram` trigger is enabled, and Apps Script **Executions** shows no error.
- **No group alert:** Run `testGroupMessage`, check the group ID, and verify the bot can post to the group.
- **No Sheet row:** Run `initializeSheet` and verify `SPREADSHEET_ID` and `SHEET_NAME`.
- **Wrong displayed time:** Correct the Apps Script project time zone in Project Settings and `appsscript.json`.
- **Alerts arrive late:** Verify `checkOverdue` runs every minute. Actual delivery can lag by one trigger interval.
- **Duplicate or overlapping runs:** The code uses a script lock; also make sure only one account owns each trigger.
