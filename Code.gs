/**
 * Off-hours lab check-in bot for Telegram and Google Apps Script.
 *
 * Required Script Properties:
 *   BOT_TOKEN       Telegram bot token from BotFather
 *   GROUP_CHAT_ID   Telegram group/chat ID for overdue alerts
 *
 * Optional Script Properties:
 *   SPREADSHEET_ID       Spreadsheet ID (omit for a bound script)
 *   SHEET_NAME           Defaults to OffHourCheckIn
 *   REMINDER_BEFORE_MIN  Defaults to 15
 *   ALERT_AFTER_MIN      Defaults to 15
 */

const DEFAULTS = Object.freeze({
  SHEET_NAME: 'OffHourCheckIn',
  REMINDER_BEFORE_MIN: 15,
  ALERT_AFTER_MIN: 15
});

const COLUMNS = Object.freeze({
  TELEGRAM_ID: 1,
  NAME: 2,
  USERNAME: 3,
  CHECK_IN: 4,
  EXPECTED_OUT: 5,
  CHECK_OUT: 6,
  REMINDER_SENT: 7,
  ALERT_SENT: 8
});

const HEADERS = [
  'Telegram ID',
  'Name',
  'Username',
  'Check In',
  'Expected Out',
  'Check Out',
  'Reminder Sent',
  'Alert Sent'
];

// -----------------------------------------------------------------------------
// Setup and diagnostics
// -----------------------------------------------------------------------------

/** Creates the configured sheet and header row if needed. Run once during setup. */
function initializeSheet() {
  const spreadsheet = getSpreadsheet_();
  const sheetName = getOptionalProperty_('SHEET_NAME', DEFAULTS.SHEET_NAME);
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return 'Ready: ' + spreadsheet.getName() + ' / ' + sheet.getName();
}

/** Validates configuration without printing secret values. */
function validateSetup() {
  getRequiredProperty_('BOT_TOKEN');
  getRequiredProperty_('GROUP_CHAT_ID');
  validateNonNegativeNumberProperty_('REMINDER_BEFORE_MIN');
  validateNonNegativeNumberProperty_('ALERT_AFTER_MIN');
  const sheet = getSheet_();

  console.log('Configuration is valid. Sheet: ' + sheet.getName());
}

// -----------------------------------------------------------------------------
// Telegram polling and command routing
// -----------------------------------------------------------------------------

/** Polls Telegram for new messages. Install as a one-minute time-driven trigger. */
function pollTelegram() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return;
  }

  try {
    const props = PropertiesService.getScriptProperties();
    let offset = Number(props.getProperty('TELEGRAM_OFFSET') || 0);
    const updates = telegramRequest_('getUpdates', {
      timeout: 0,
      offset: offset,
      allowed_updates: ['message']
    });

    updates.forEach(function (update) {
      try {
        processTelegramUpdate(update);
      } catch (error) {
        console.error('Error processing update ' + update.update_id + ': ' + error);
      } finally {
        offset = update.update_id + 1;
        props.setProperty('TELEGRAM_OFFSET', String(offset));
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function processTelegramUpdate(update) {
  if (!update.message || !update.message.text) {
    return;
  }

  const msg = update.message;
  if (msg.chat.type !== 'private') {
    return;
  }

  const chatId = msg.chat.id;
  const user = msg.from;
  const text = normalizeCommand_(msg.text);

  if (text === '/start' || text === '/help') {
    showMainKeyboard_(
      chatId,
      'Weekend / off-hours lab check-in\n\n' +
        'You can either use the buttons below, or type commands directly for custom times.\n\n' +
        'Examples:\n' +
        '/in 30m   — check in for 30 minutes\n' +
        '/in 90m   — check in for 90 minutes\n' +
        '/in 1.5h  — check in for 1.5 hours\n' +
        '/extend 30m   — extend by 30 minutes\n' +
        '/extend 2h    — extend by 2 hours\n' +
        '/out      — check out\n' +
        '/status   — show your current status\n\n' +
        'For common durations, simply use the buttons below.'
    );
    return;
  }

  const buttonActions = {
    'check in 1h': function () { handleCheckIn_(chatId, user, '/in 1h'); },
    'check in 2h': function () { handleCheckIn_(chatId, user, '/in 2h'); },
    'check in 3h': function () { handleCheckIn_(chatId, user, '/in 3h'); },
    'check in 4h': function () { handleCheckIn_(chatId, user, '/in 4h'); },
    'extend +1h': function () { handleExtend_(chatId, user, '/extend 1h'); },
    'extend +2h': function () { handleExtend_(chatId, user, '/extend 2h'); },
    'check out': function () { handleCheckOut_(chatId, user); },
    status: function () { handleStatus_(chatId, user); }
  };

  if (buttonActions[text]) {
    buttonActions[text]();
    return;
  }

  if (text === 'other') {
    sendMessage_(
      chatId,
      'Custom commands:\n\n' +
        '/in 30m\n' +
        '/in 90m\n' +
        '/in 1.5h\n' +
        '/extend 30m\n' +
        '/extend 2h\n' +
        '/out\n' +
        '/status'
    );
    return;
  }

  if (/^\/in(?:\s|$)/.test(text)) {
    handleCheckIn_(chatId, user, text);
    return;
  }

  if (text === '/out') {
    handleCheckOut_(chatId, user);
    return;
  }

  if (/^\/extend(?:\s|$)/.test(text)) {
    handleExtend_(chatId, user, text);
    return;
  }

  if (text === '/status') {
    handleStatus_(chatId, user);
    return;
  }

  showMainKeyboard_(
    chatId,
    'I did not understand that.\n\n' +
      'Please use one of the buttons below, or press "Other" for custom commands.'
  );
}

// -----------------------------------------------------------------------------
// Check-in actions
// -----------------------------------------------------------------------------

function handleCheckIn_(chatId, user, text) {
  const duration = parseDuration_(text.replace(/^\/in\b/, '').trim());
  if (!duration) {
    sendMessage_(
      chatId,
      'Please specify how long you expect to stay.\n\n' +
        'Examples:\n/in 30m\n/in 90m\n/in 2h\n/in 1.5h'
    );
    return;
  }

  closeOpenSession_(user.id);
  const now = new Date();
  const expectedOut = new Date(now.getTime() + duration);
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');

  getSheet_().appendRow([
    String(user.id),
    name,
    user.username || '',
    now,
    expectedOut,
    '',
    false,
    false
  ]);

  showMainKeyboard_(
    chatId,
    '✅ Checked in.\n\nPlanned checkout: ' + formatTime_(expectedOut) +
      '\n\nPlease press "Check out" when you leave.'
  );
}

function handleCheckOut_(chatId, user) {
  const row = findOpenSessionRow_(user.id);
  if (!row) {
    showMainKeyboard_(chatId, 'You do not currently have an open lab check-in.');
    return;
  }

  getSheet_().getRange(row, COLUMNS.CHECK_OUT).setValue(new Date());
  showMainKeyboard_(chatId, '✅ Checked out.\n\nHave a good weekend!');
}

function handleExtend_(chatId, user, text) {
  const duration = parseDuration_(text.replace(/^\/extend\b/, '').trim());
  if (!duration) {
    sendMessage_(
      chatId,
      'Please specify an extension.\n\n' +
        'Examples:\n/extend 30m\n/extend 1h\n/extend 1.5h'
    );
    return;
  }

  const row = findOpenSessionRow_(user.id);
  if (!row) {
    showMainKeyboard_(chatId, 'You do not currently have an open lab check-in.');
    return;
  }

  const sheet = getSheet_();
  const oldExpected = new Date(sheet.getRange(row, COLUMNS.EXPECTED_OUT).getValue());
  const newExpected = new Date(oldExpected.getTime() + duration);

  sheet.getRange(row, COLUMNS.EXPECTED_OUT).setValue(newExpected);
  sheet.getRange(row, COLUMNS.REMINDER_SENT, 1, 2).setValues([[false, false]]);

  showMainKeyboard_(
    chatId,
    '✅ Stay extended.\n\nNew planned checkout: ' + formatTime_(newExpected)
  );
}

function handleStatus_(chatId, user) {
  const row = findOpenSessionRow_(user.id);
  if (!row) {
    showMainKeyboard_(chatId, 'You are not currently checked in.');
    return;
  }

  const expected = new Date(getSheet_().getRange(row, COLUMNS.EXPECTED_OUT).getValue());
  showMainKeyboard_(
    chatId,
    'You are currently checked in.\n\nExpected checkout: ' + formatTime_(expected)
  );
}

// -----------------------------------------------------------------------------
// Reminders and overdue alerts
// -----------------------------------------------------------------------------

/** Checks open sessions. Install as a one-minute time-driven trigger. */
function checkOverdue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return;
  }

  try {
    const sheet = getSheet_();
    const data = sheet.getDataRange().getValues();
    const now = new Date();
    const reminderBeforeMs = getMinutesProperty_(
      'REMINDER_BEFORE_MIN',
      DEFAULTS.REMINDER_BEFORE_MIN
    ) * 60 * 1000;
    const alertAfterMs = getMinutesProperty_(
      'ALERT_AFTER_MIN',
      DEFAULTS.ALERT_AFTER_MIN
    ) * 60 * 1000;

    for (let i = 1; i < data.length; i += 1) {
      const row = data[i];
      const telegramId = row[COLUMNS.TELEGRAM_ID - 1];
      const expectedOut = row[COLUMNS.EXPECTED_OUT - 1];
      const checkOut = row[COLUMNS.CHECK_OUT - 1];

      if (!telegramId || !expectedOut || checkOut) {
        continue;
      }

      const expected = new Date(expectedOut);
      const reminderTime = new Date(expected.getTime() - reminderBeforeMs);
      const alertTime = new Date(expected.getTime() + alertAfterMs);
      const sheetRow = i + 1;

      if (
        now >= reminderTime &&
        now < alertTime &&
        row[COLUMNS.REMINDER_SENT - 1] !== true
      ) {
        showMainKeyboard_(
          telegramId,
          '⏰ Reminder\n\nYour planned checkout time is ' + formatTime_(expected) +
            '.\n\nIf you are leaving, press "Check out".\n' +
            'If you are staying longer, press an extension button or use a custom /extend command.'
        );
        sheet.getRange(sheetRow, COLUMNS.REMINDER_SENT).setValue(true);
      }

      if (now >= alertTime && row[COLUMNS.ALERT_SENT - 1] !== true) {
        sendMessage_(
          getRequiredProperty_('GROUP_CHAT_ID'),
          '⚠️ OFF-HOURS LAB CHECK\n\n' +
            row[COLUMNS.NAME - 1] + ' checked in at ' +
            formatTime_(new Date(row[COLUMNS.CHECK_IN - 1])) +
            ' and planned to leave by ' + formatTime_(expected) +
            '.\n\nThey have not checked out. Please check that they are OK.'
        );

        // Record the successful group alert before the optional private follow-up.
        // This avoids repeating the group alert if the private message fails.
        sheet.getRange(sheetRow, COLUMNS.ALERT_SENT).setValue(true);

        try {
          showMainKeyboard_(
            telegramId,
            '⚠️ You have not checked out and the lab safety group has been notified.\n\n' +
              'If you are still working, please extend your stay.\n' +
              'If you have left, press "Check out".'
          );
        } catch (error) {
          console.error('Could not send overdue follow-up to ' + telegramId + ': ' + error);
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// -----------------------------------------------------------------------------
// Telegram helpers
// -----------------------------------------------------------------------------

function showMainKeyboard_(chatId, text) {
  const keyboard = [
    ['Check in 1h', 'Check in 2h'],
    ['Check in 3h', 'Check in 4h'],
    ['Extend +1h', 'Extend +2h'],
    ['Check out', 'Status'],
    ['Other']
  ];

  telegramRequest_('sendMessage', {
    chat_id: String(chatId),
    text: text,
    reply_markup: {
      keyboard: keyboard.map(function (row) {
        return row.map(function (label) { return { text: label }; });
      }),
      resize_keyboard: true,
      is_persistent: true
    }
  });
}

function sendMessage_(chatId, text) {
  telegramRequest_('sendMessage', {
    chat_id: String(chatId),
    text: text
  });
}

function telegramRequest_(method, payload) {
  const url = 'https://api.telegram.org/bot' +
    getRequiredProperty_('BOT_TOKEN') + '/' + method;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const body = JSON.parse(response.getContentText());

  if (!body.ok) {
    throw new Error('Telegram API ' + method + ' failed: ' + body.description);
  }

  return body.result;
}

// -----------------------------------------------------------------------------
// Data and configuration helpers
// -----------------------------------------------------------------------------

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId.trim());
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'No active spreadsheet. Set SPREADSHEET_ID in Script Properties or bind the script to a Sheet.'
    );
  }
  return spreadsheet;
}

function getSheet_() {
  const sheetName = getOptionalProperty_('SHEET_NAME', DEFAULTS.SHEET_NAME);
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" was not found. Run initializeSheet() first.');
  }
  return sheet;
}

function findOpenSessionRow_(telegramId) {
  const data = getSheet_().getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i -= 1) {
    if (
      String(data[i][COLUMNS.TELEGRAM_ID - 1]) === String(telegramId) &&
      !data[i][COLUMNS.CHECK_OUT - 1]
    ) {
      return i + 1;
    }
  }
  return null;
}

function closeOpenSession_(telegramId) {
  const row = findOpenSessionRow_(telegramId);
  if (row) {
    getSheet_().getRange(row, COLUMNS.CHECK_OUT).setValue(new Date());
  }
}

function parseDuration_(text) {
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|m|min|mins)$/);
  if (!match) {
    return null;
  }

  const amount = parseFloat(match[1]);
  if (!isFinite(amount) || amount <= 0) {
    return null;
  }

  return amount * (match[2].charAt(0) === 'h' ? 60 * 60 * 1000 : 60 * 1000);
}

function normalizeCommand_(text) {
  return text.trim().toLowerCase().replace(/^\/(\w+)@\w+/, '/$1');
}

function formatTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEE HH:mm');
}

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value || !value.trim()) {
    throw new Error('Missing required Script Property: ' + name);
  }
  return value.trim();
}

function getOptionalProperty_(name, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  return value && value.trim() ? value.trim() : fallback;
}

function getMinutesProperty_(name, fallback) {
  const raw = getOptionalProperty_(name, String(fallback));
  const value = Number(raw);
  if (!isFinite(value) || value < 0) {
    throw new Error(name + ' must be a non-negative number.');
  }
  return value;
}

function validateNonNegativeNumberProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (value !== null) {
    getMinutesProperty_(name, 0);
  }
}

// -----------------------------------------------------------------------------
// Optional tests
// -----------------------------------------------------------------------------

function testGroupMessage() {
  sendMessage_(
    getRequiredProperty_('GROUP_CHAT_ID'),
    'Test message from the OffHourCheckIn bot.'
  );
}

function testSheet() {
  console.log('Sheet found: ' + getSheet_().getName());
}
