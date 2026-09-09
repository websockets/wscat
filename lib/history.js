'use strict';

const fs = require('fs');

/**
 * Restore readline history and append submitted lines to a shared history file.
 *
 * @param {readline.Interface} rl The readline interface
 * @param {String} filename The history file path
 * @param {Function} onError Called once if history cannot be read or written
 */
function setupHistory(rl, filename, onError) {
  let contents = '';

  try {
    contents = fs.readFileSync(filename, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      onError(err);
      return;
    }
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
      onError(err);
    }
  }

  rl.on('line', appendHistory);
}

module.exports = setupHistory;
