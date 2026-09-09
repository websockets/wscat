'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { PassThrough } = require('stream');
const { test } = require('node:test');

const setupHistory = require('../lib/history');

function createHistoryFile(t, contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wscat-history-'));
  const filename = path.join(directory, '.wscat_history');

  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  if (contents !== undefined) fs.writeFileSync(filename, contents);

  return filename;
}

function createSession(t, filename) {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = readline.createInterface({
    input,
    output,
    terminal: true,
    historySize: 1000
  });

  output.resume();
  t.after(() => {
    rl.close();
    input.destroy();
    output.destroy();
  });
  setupHistory(rl, filename);

  return rl;
}

test('creates a private file only when a nonblank line is submitted', (t) => {
  const filename = createHistoryFile(t);
  const rl = createSession(t, filename);

  assert.deepStrictEqual(rl.history, []);
  rl.write('\n   \n\t\n');
  assert.strictEqual(fs.existsSync(filename), false);

  rl.once('line', () => {
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), 'hello\n');
  });
  rl.write('hello\n');

  if (process.platform !== 'win32') {
    assert.strictEqual(fs.statSync(filename).mode & 0o777, 0o600);
  }
});

test('preserves payloads and skips consecutive duplicates', (t) => {
  const filename = createHistoryFile(t);
  const rl = createSession(t, filename);
  const message = '  {"message":"héllo 世界"}  ';

  rl.write(`${message}\n\n${message}\n/ping data\n${message}\n`);

  assert.strictEqual(
    fs.readFileSync(filename, 'utf8'),
    `${message}\n/ping data\n${message}\n`
  );
});

test('recalls previous sessions with Up and Down and saves submitted edits', (t) => {
  const filename = createHistoryFile(t);
  const first = createSession(t, filename);

  first.write('first\nsecond\n');
  first.close();

  const second = createSession(t, filename);

  second.write(null, { name: 'up' });
  assert.strictEqual(second.line, 'second');
  second.write(null, { name: 'up' });
  assert.strictEqual(second.line, 'first');
  second.write(null, { name: 'down' });
  assert.strictEqual(second.line, 'second');
  second.write(' edited');
  assert.strictEqual(fs.readFileSync(filename, 'utf8'), 'first\nsecond\n');
  second.write('\n');
  second.close();

  const third = createSession(t, filename);

  third.write(null, { name: 'up' });
  assert.strictEqual(third.line, 'second edited');
  third.write(null, { name: 'up' });
  assert.strictEqual(third.line, 'second');
});

test('loads CRLF files and separates a final line without a newline', (t) => {
  const filename = createHistoryFile(t, 'first\r\n\r\n  \r\nsecond\r\nsecond');
  const rl = createSession(t, filename);

  assert.deepStrictEqual(rl.history, ['second', 'first']);
  rl.write('second\nthird\n');
  assert.strictEqual(
    fs.readFileSync(filename, 'utf8'),
    'first\r\n\r\n  \r\nsecond\r\nsecond\nthird\n'
  );
});

test('loads only the latest 1000 entries', (t) => {
  const lines = Array.from({ length: 1005 }, (_, i) => `message ${i}`);
  const filename = createHistoryFile(t, lines.join('\n') + '\n');
  const rl = createSession(t, filename);

  assert.strictEqual(rl.history.length, 1000);
  assert.strictEqual(rl.history[0], 'message 1004');
  assert.strictEqual(rl.history[999], 'message 5');
  rl.write('new message\n');
  assert.strictEqual(rl.history.length, 1000);
  assert.strictEqual(rl.history[0], 'new message');
});

test("interleaved sessions preserve each other's submitted lines", (t) => {
  const filename = createHistoryFile(t, 'original\n');
  const first = createSession(t, filename);
  const second = createSession(t, filename);

  first.write('first\n');
  second.write('second\n');
  first.write('third\n');
  second.close();
  first.close();

  assert.strictEqual(
    fs.readFileSync(filename, 'utf8'),
    'original\nfirst\nsecond\nthird\n'
  );
  assert.deepStrictEqual(createSession(t, filename).history, [
    'third',
    'second',
    'first',
    'original'
  ]);
});

test('keeps in-memory history after a read failure', (t) => {
  const filename = createHistoryFile(t);

  fs.mkdirSync(filename);

  const rl = createSession(t, filename);

  rl.write('first\nsecond\n');
  assert.ok(fs.statSync(filename).isDirectory());
  rl.write(null, { name: 'up' });
  assert.strictEqual(rl.line, 'second');
});

test('keeps in-memory history without retrying after a write failure', (t) => {
  const filename = createHistoryFile(t);
  const rl = createSession(t, filename);

  fs.mkdirSync(filename);
  rl.write('first\n');
  fs.rmdirSync(filename);
  rl.write('second\n');

  assert.strictEqual(fs.existsSync(filename), false);
  rl.write(null, { name: 'up' });
  assert.strictEqual(rl.line, 'second');
});
