'use strict';

const readline = require('readline');
const { PassThrough } = require('stream');

/**
 * Create a readline interface with a Ctrl+T formatting toggle.
 *
 * @param {Object} options The readline options
 * @return {readline.Interface} The readline interface
 */
function createInterface(options) {
  const source = options.input;

  if (!source.isTTY || !options.output.isTTY || options.terminal === false) {
    return readline.createInterface(options);
  }

  // Dispatch keys through write() so Ctrl+T does not edit the current line.
  const input = new PassThrough();

  input.isRaw = source.isRaw;
  input.setRawMode = (mode) => {
    if (source.setRawMode) source.setRawMode(mode);
    input.isRaw = source.isRaw;
    return input;
  };

  const rl = readline.createInterface({ ...options, input });
  const onKeypress = (data, key = {}) => {
    if (key.ctrl && !key.meta && key.name === 't') rl.emit('togglePretty');
    else rl.write(data, key);
  };
  const onEnd = () => input.end();
  const onError = (err) => input.destroy(err);
  const onPause = () => source.pause();
  const onResume = () => source.resume();

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

module.exports = createInterface;
