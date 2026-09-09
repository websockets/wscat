'use strict';

const assert = require('assert');
const { once } = require('events');
const { PassThrough } = require('stream');
const { test } = require('node:test');

const createReadline = require('../lib/pretty-readline');

function createSession(t, history = [], terminal = true) {
  const input = new PassThrough();
  const output = new PassThrough();
  const modes = [];

  input.isTTY = output.isTTY = terminal;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    modes.push(mode);
  };

  const rl = createReadline({ input, output, history: history.slice() });
  const lines = [];

  rl.on('line', (line) => lines.push(line));
  output.resume();
  t.after(() => {
    rl.close();
    input.destroy();
    output.destroy();
  });

  return { input, output, rl, lines, modes };
}

test('Ctrl+T toggles without editing or submitting the current draft', (t) => {
  const { input, rl, lines } = createSession(t);
  let toggles = 0;

  rl.on('togglePretty', () => toggles++);
  input.write('draft\x1b[D\x14\x14');
  assert.strictEqual(toggles, 2);
  assert.strictEqual(rl.line, 'draft');
  assert.strictEqual(rl.cursor, 4);
  assert.deepStrictEqual(lines, []);
});

test('Ctrl+T preserves an arrow-recalled command and its cursor', (t) => {
  const { input, rl, lines } = createSession(t, ['previous command']);

  input.write('\x1b[A\x1b[D\x14');
  assert.strictEqual(rl.line, 'previous command');
  assert.strictEqual(rl.cursor, 'previous comman'.length);
  input.write('!\r');
  assert.deepStrictEqual(lines, ['previous comman!d']);
});

test('Ctrl+C keeps its normal exit behavior and restores terminal mode', (t) => {
  const { input, rl, lines, modes } = createSession(t);

  input.write('draft\x03');
  assert.strictEqual(rl.closed, true);
  assert.deepStrictEqual(lines, []);
  assert.deepStrictEqual(modes, [true, false]);
  assert.strictEqual(input.listenerCount('keypress'), 0);
});

test('ordinary editing, arrow recall and Ctrl+D continue to work', (t) => {
  const { input, rl, lines } = createSession(t);

  input.write('hello\x1b[D');
  input.write('!');
  input.write('\r\x1b[A\r\x04');
  assert.deepStrictEqual(lines, ['hell!o', 'hell!o']);
  assert.strictEqual(rl.closed, true);
});

test('redirected streams preserve literal Ctrl+T input without raw mode', (t) => {
  const { input, lines, modes } = createSession(t, [], false);

  input.write('literal\x14payload\n');
  assert.deepStrictEqual(lines, ['literal\x14payload']);
  assert.deepStrictEqual(modes, []);
});

test('ending input forwards the last line and restores terminal mode', async (t) => {
  const { input, rl, lines, modes } = createSession(t);
  const closed = once(rl, 'close');

  input.end('draft');
  await closed;
  assert.deepStrictEqual(lines, ['draft']);
  assert.deepStrictEqual(modes, [true, false]);
});

test('pausing and resuming readline also pauses and resumes terminal input', (t) => {
  const { input, rl, lines } = createSession(t);

  rl.pause();
  assert.strictEqual(input.isPaused(), true);
  rl.resume();
  assert.strictEqual(input.isPaused(), false);
  input.write('hello\r');
  assert.deepStrictEqual(lines, ['hello']);
});
