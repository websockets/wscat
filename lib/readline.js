'use strict';

const readline = require('readline');
const { PassThrough } = require('stream');

/**
 * Create a readline interface with incremental reverse history search.
 *
 * @param {Object} options The readline options
 * @return {readline.Interface} The readline interface
 */
function createInterface(options) {
  const source = options.input;

  if (!source.isTTY || !options.output.isTTY || options.terminal === false) {
    return readline.createInterface(options);
  }

  // Dispatch terminal keys through the public write() API so search can consume
  // them without replacing readline's internal key handling methods.
  const input = new PassThrough();

  input.isRaw = source.isRaw;
  input.setRawMode = (mode) => {
    if (source.setRawMode) source.setRawMode(mode);
    input.isRaw = source.isRaw;
    return input;
  };

  const rl = readline.createInterface({ ...options, input });
  const handleKey = createKeyHandler(rl);
  const onKeypress = (data, key) => {
    if (!handleKey(data, key)) rl.write(data, key);
  };
  const onEnd = () => {
    handleKey(null, { ctrl: true, name: 'g' });
    input.end();
  };
  const onError = (err) => input.destroy(err);
  const onPause = () => source.pause();
  const onResume = () => source.resume();

  // Keep decoding separate: Node's completion-disabled paste path appends text
  // instead of inserting it at the cursor in the middle of a line.
  readline.emitKeypressEvents(source);
  source.on('keypress', onKeypress);
  source.on('end', onEnd);
  source.on('error', onError);
  rl.on('pause', onPause);
  rl.on('resume', onResume);
  rl.once('close', () => {
    source.removeListener('keypress', onKeypress);
    source.removeListener('end', onEnd);
    source.removeListener('error', onError);
    rl.removeListener('pause', onPause);
    rl.removeListener('resume', onResume);
    input.destroy();
  });
  source.resume();

  return rl;
}

function createKeyHandler(rl) {
  let state;
  let previousQuery = '';

  function render(failed = false) {
    const label = failed ? 'failed reverse-i-search' : 'reverse-i-search';

    rl.setPrompt(`(${label})\`${state.query}': `);
    rl.prompt(true);
  }

  function find(start) {
    for (let i = start; i < rl.history.length; i++) {
      if (rl.history[i].includes(state.query)) {
        state.index = i;
        rl.line = rl.history[i];
        rl.cursor = rl.line.length;
        render();
        return;
      }
    }

    // Keep the last match and stay at the end instead of wrapping around.
    render(true);
  }

  function finish(restore) {
    if (state.query) previousQuery = state.query;
    if (restore) {
      rl.line = state.line;
      rl.cursor = state.cursor;
    }
    rl.setPrompt(state.prompt);
    state = undefined;
    rl.prompt(true);
  }

  return (data, key = {}) => {
    if (key.ctrl && !key.meta && key.name === 'r') {
      if (!state) {
        state = {
          query: '',
          index: -1,
          line: rl.line,
          cursor: rl.cursor,
          prompt: rl.getPrompt()
        };
        render();
      } else {
        if (!state.query) state.query = previousQuery;
        find(state.index + 1);
      }
      return true;
    }

    if (
      key.ctrl &&
      !key.meta &&
      key.name === 'c' &&
      (rl.line || (state && state.query))
    ) {
      rl.line = '';
      rl.cursor = 0;
      if (state) finish(false);
      else rl.prompt(true);
      return true;
    }

    if (!state) return false;

    if (key.name === 'paste-start' || key.name === 'paste-end') return true;

    if (key.ctrl && key.name === 'g') {
      finish(true);
      return true;
    }

    if (key.name === 'escape') {
      finish(false);
      return true;
    }

    if (key.name === 'backspace' || (key.ctrl && key.name === 'h')) {
      state.query = Array.from(state.query).slice(0, -1).join('');
      find(0);
      return true;
    }

    if (!key.ctrl && !key.meta && data && !/[\x00-\x1f\x7f-\x9f]/.test(data)) {
      state.query += data;
      find(Math.max(0, state.index));
      return true;
    }

    // Enter submits the selected line. Other editing keys leave search and are
    // handled normally by readline. Ctrl+C closes only when input is empty.
    finish(false);
    return false;
  };
}

module.exports = createInterface;
