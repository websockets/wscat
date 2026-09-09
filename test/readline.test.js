'use strict';

const assert = require('assert');
const { once } = require('events');
const { PassThrough } = require('stream');
const { test } = require('node:test');

const createReadline = require('../lib/readline');

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

test('Ctrl+R searches substrings newest first and repeats toward older matches', (t) => {
  const history = ['latest apple', 'orange', 'older apple', 'oldest apple'];
  const { input, rl, lines } = createSession(t, history);

  input.write('\x12apple');
  assert.strictEqual(rl.line, 'latest apple');
  assert.strictEqual(rl.getPrompt(), "(reverse-i-search)`apple': ");
  input.write('\x12');
  assert.strictEqual(rl.line, 'older apple');
  input.write('\x12');
  assert.strictEqual(rl.line, 'oldest apple');
  input.write('\x12');
  assert.strictEqual(rl.line, 'oldest apple');
  assert.match(rl.getPrompt(), /failed reverse-i-search/);
  assert.deepStrictEqual(lines, []);
  assert.deepStrictEqual(rl.history, history);

  input.write('\r');
  assert.deepStrictEqual(lines, ['oldest apple']);
  assert.strictEqual(rl.getPrompt(), '> ');
});

test('search refines the current match and backspace can recover from a miss', (t) => {
  const { input, rl } = createSession(t, ['new apple', 'old apricot']);

  input.write('\x12ap');
  assert.strictEqual(rl.line, 'new apple');
  input.write('r');
  assert.strictEqual(rl.line, 'old apricot');
  input.write('x');
  assert.match(rl.getPrompt(), /failed reverse-i-search/);
  input.write('\x7f');
  assert.strictEqual(rl.line, 'old apricot');
  assert.strictEqual(rl.getPrompt(), "(reverse-i-search)`apr': ");
  input.write('\x7f');
  assert.strictEqual(rl.line, 'new apple');
});

test('Ctrl+G restores the original draft, cursor and prompt without submitting', (t) => {
  const { input, rl, lines } = createSession(t, ['found message']);

  rl.setPrompt('custom> ');
  input.write('draft\x1b[D\x12found');
  assert.strictEqual(rl.line, 'found message');
  input.write('\x07');
  assert.strictEqual(rl.line, 'draft');
  assert.strictEqual(rl.cursor, 4);
  assert.strictEqual(rl.getPrompt(), 'custom> ');
  assert.deepStrictEqual(lines, []);
});

test('Escape accepts the match for editing without submitting it', (t) => {
  const { input, rl, lines } = createSession(t, ['found message']);

  input.write('\x12found');
  input.emit('keypress', '\x1b', { name: 'escape' });
  assert.strictEqual(rl.getPrompt(), '> ');
  assert.deepStrictEqual(lines, []);
  input.write(' edited\r');
  assert.deepStrictEqual(lines, ['found message edited']);
});

test('editing keys leave search and apply to the selected command', (t) => {
  const { input, lines } = createSession(t, ['apple']);

  input.write('\x12app\x1b[D');
  input.write('!');
  input.write('\r');
  assert.deepStrictEqual(lines, ['appl!e']);
});

test('an empty or unmatched history never submits the search text', (t) => {
  const { input, rl, lines } = createSession(t);

  input.write('draft\x12not found');
  assert.match(rl.getPrompt(), /failed reverse-i-search/);
  assert.strictEqual(rl.line, 'draft');
  assert.deepStrictEqual(lines, []);
  input.write('\x07\r');
  assert.deepStrictEqual(lines, ['draft']);
});

test('Ctrl+R can reuse the previous query and search newly submitted commands', (t) => {
  const { input, rl } = createSession(t);

  input.write('first apple\rsecond apple\r\x12apple\x12\r');
  input.write('third apple\r\x12\x12');
  assert.strictEqual(rl.line, 'third apple');
  assert.strictEqual(rl.getPrompt(), "(reverse-i-search)`apple': ");
});

test('search and backspace preserve Unicode characters', (t) => {
  const { input, rl, lines } = createSession(t, ['hello 世界 🍎']);

  input.write('\x12世界 🍎');
  assert.strictEqual(rl.line, 'hello 世界 🍎');
  input.write('\x7f');
  assert.strictEqual(rl.getPrompt(), "(reverse-i-search)`世界 ': ");
  input.write('\r');
  assert.deepStrictEqual(lines, ['hello 世界 🍎']);
});

test('Ctrl+C still closes during search and restores terminal mode', (t) => {
  const { input, rl, lines, modes } = createSession(t, ['hello']);

  input.write('\x12hello\x03');
  assert.strictEqual(rl.closed, true);
  assert.deepStrictEqual(modes, [true, false]);
  assert.deepStrictEqual(lines, []);
  assert.strictEqual(input.listenerCount('keypress'), 0);
});

test('ordinary editing, arrow history and Ctrl+D continue to work', (t) => {
  const { input, rl, lines } = createSession(t);

  input.write('hello\x1b[D');
  input.write('!');
  input.write('\r\x1b[A\r\x04');
  assert.deepStrictEqual(lines, ['hell!o', 'hell!o']);
  assert.strictEqual(rl.closed, true);
});

test('redirected streams preserve literal input and do not use raw mode', (t) => {
  const { input, lines, modes } = createSession(t, [], false);

  input.write('literal\x12payload\n');
  assert.deepStrictEqual(lines, ['literal\x12payload']);
  assert.deepStrictEqual(modes, []);
});

test('ending input during search does not submit an unaccepted match', async (t) => {
  const { input, rl, lines, modes } = createSession(t, ['hello']);
  const closed = once(rl, 'close');

  input.write('\x12hello');
  input.end();
  await closed;
  assert.deepStrictEqual(lines, []);
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

for (const payload of ['rwietsevLFg8XSmG3bEZzFein1g8RBZqWD', 'héllo 世界 🍎']) {
  test(`pasting ${payload} inserts at the cursor and preserves the suffix`, (t) => {
    const { input, rl, lines } = createSession(t);
    const before = '{"command":"account_info", "account": "';
    const after = '" }';

    input.write(before + after);
    input.write('\x1b[D'.repeat(after.length));
    assert.strictEqual(rl.cursor, before.length);
    input.write(payload);
    assert.strictEqual(rl.line, before + payload + after);
    assert.strictEqual(rl.cursor, before.length + payload.length);
    assert.deepStrictEqual(lines, []);
    input.write('\r');
    assert.deepStrictEqual(lines, [before + payload + after]);
  });
}

test('pasting after a Unicode prefix uses the character cursor position', (t) => {
  const { input, rl, lines } = createSession(t);
  const before = '{"🍎":"世界", "account":"';
  const after = '"}';

  input.write(before + after);
  input.write('\x1b[D'.repeat(after.length));
  input.write('address');
  assert.strictEqual(rl.line, before + 'address' + after);
  assert.strictEqual(rl.cursor, before.length + 'address'.length);
  input.write('\r');
  assert.deepStrictEqual(lines, [before + 'address' + after]);
});

test('pasting into a recalled command preserves its remaining text', (t) => {
  const { input, rl, lines } = createSession(t, ['{"account":""}']);

  input.write('\x1b[A\x1b[D\x1b[D');
  input.write('address');
  assert.strictEqual(rl.line, '{"account":"address"}');
  input.write('\r');
  assert.deepStrictEqual(lines, ['{"account":"address"}']);
});

test('a paste split across UTF-8 bytes preserves the text and cursor', (t) => {
  const { input, rl, lines } = createSession(t);
  const bytes = Buffer.from('世界🍎');

  input.write('""');
  input.write('\x1b[D');
  input.write(bytes.subarray(0, 4));
  input.write(bytes.subarray(4));
  assert.strictEqual(rl.line, '"世界🍎"');
  assert.strictEqual(rl.cursor, '"世界🍎'.length);
  input.write('\r');
  assert.deepStrictEqual(lines, ['"世界🍎"']);
});

test('bracketed paste inserts text without retaining terminal markers', (t) => {
  const { input, rl, lines } = createSession(t);

  input.write('""\x1b[D');
  input.write('\x1b[200~address\x1b[201~');
  assert.strictEqual(rl.line, '"address"');
  assert.strictEqual(rl.cursor, '"address'.length);
  assert.deepStrictEqual(lines, []);
  input.write('\r');
  assert.deepStrictEqual(lines, ['"address"']);
});

test('bracketed paste can supply a reverse-search query without leaving search', (t) => {
  const { input, rl, lines } = createSession(t, ['message containing address']);

  input.write('\x12\x1b[200~address\x1b[201~');
  assert.strictEqual(rl.getPrompt(), "(reverse-i-search)`address': ");
  assert.strictEqual(rl.line, 'message containing address');
  assert.deepStrictEqual(lines, []);
  input.write('\r');
  assert.deepStrictEqual(lines, ['message containing address']);
});
