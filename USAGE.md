# Usage

All check-in interactions happen in a private chat with the bot. The bot ignores commands posted in groups.

## Reply keyboard

Send `/start` or `/help` to show the persistent keyboard:

- **Check in 1h**, **2h**, **3h**, or **4h**
- **Extend +1h** or **+2h**
- **Check out**
- **Status**
- **Other**, which displays the manual-command guide

## Manual commands

| Command | Result |
| --- | --- |
| `/in 30m` | Check in for 30 minutes |
| `/in 90m` | Check in for 90 minutes |
| `/in 1.5h` | Check in for 1.5 hours |
| `/extend 30m` | Add 30 minutes to the planned checkout |
| `/extend 2h` | Add two hours to the planned checkout |
| `/out` | Close the current check-in |
| `/status` | Show whether you are checked in and the planned checkout time |
| `/start` or `/help` | Show help and the reply keyboard |

Durations accept positive numbers followed by `m`, `min`, `mins`, `h`, `hr`, or `hrs`. Decimal hours such as `1.5h` are supported.

## Behavior

- Starting a new check-in automatically closes any previous open check-in for the same Telegram user.
- Extending a visit adds time to the existing planned checkout and resets its reminder and alert flags.
- Before the planned checkout, the bot privately reminds the user to check out or extend.
- After the configured grace period, the bot alerts the safety group and privately tells the user that an alert was sent.
- Each reminder and overdue alert is sent once per session unless the visit is extended.

## Lab member onboarding

Share the bot's `https://t.me/YOUR_BOT_USERNAME` link with lab members. Each person must open the private bot chat and press **Start** before the bot can send them private reminders.

Only people responsible for responding to overdue notices need to join the safety group.

## Operator checklist

- Periodically review Apps Script **Executions** for failures.
- Test the group-alert path after changing the bot, group, Sheet, Google account, or triggers.
- Remove triggers belonging to former operators after a successful handover.
- Restrict access to the Sheet and Script Properties.
- Rotate the bot token immediately if it may have been exposed.
