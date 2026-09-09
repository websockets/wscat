'use strict';

const fs = require('fs');

/**
 * Restore readline history and append submitted lines to a shared history file.
 * Silently disable persistence if the file cannot be read or written.
 *
 * @param {readline.Interface} rl The readline interface
 * @param {String} filename The history file path
 */
function setupHistory(rl, filename) {
  let contents = '';

  try {
    contents = fs.readFileSync(filename, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') return;
  }

  const lines = contents.split(/\r?\n/);
  const history = [];

  for (
    let i = lines.length - 1;
    i >= 0 && history.length < rl.historySize;
    i--
  ) {
    const line = lines[i];

    if (line.trim() && line !== history[history.length - 1]) {
      history.push(line);
    }
  }

  rl.history = history;

  let previous = history[0];
  let separator = contents && !contents.endsWith('\n') ? '\n' : '';

  function appendHistory(line) {
    if (!line.trim() || line === previous) return;

    try {
      // Save before line handlers can exit, without overwriting other sessions.
      fs.appendFileSync(filename, separator + line + '\n', { mode: 0o600 });
      previous = line;
      separator = '';
    } catch (err) {
      rl.removeListener('line', appendHistory);
    }
  }

  rl.on('line', appendHistory);
}

module.exports = setupHistory;
