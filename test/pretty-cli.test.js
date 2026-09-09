'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const { once } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
const { stripVTControlCharacters } = require('util');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');

function createFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wscat-cli-'));
  const preload = path.join(directory, 'terminal.js');

  // Exercise readline's terminal handling using portable child-process pipes.
  fs.writeFileSync(
    preload,
    "process.stdin.isTTY = process.env.TEST_INPUT_TTY === '1';\n" +
      "process.stdout.isTTY = process.env.TEST_OUTPUT_TTY === '1';\n" +
      "require('tty').isatty = () => process.stdout.isTTY;\n"
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  return {
    directory,
    preload
  };
}

async function createServer(t, host = '127.0.0.1') {
  const server = new WebSocket.Server({ port: 0, host });

  server.on('connection', (socket) => socket.send('ready'));
  t.after(() => {
    for (const socket of server.clients) socket.terminate();
    return new Promise((resolve) => server.close(resolve));
  });
  await once(server, 'listening');
  return server;
}

function start(t, fixture, args, options = {}) {
  const child = spawn(
    process.execPath,
    ['--require', fixture.preload, path.join(root, 'bin', 'wscat'), ...args],
    {
      cwd: fixture.directory,
      env: {
        ...process.env,
        HOME: fixture.directory,
        USERPROFILE: fixture.directory,
        TEST_INPUT_TTY: options.inputTTY === false ? '0' : '1',
        TEST_OUTPUT_TTY: options.outputTTY === false ? '0' : '1'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    }
  );
  const session = {
    child,
    output: '',
    errors: '',
    exited: once(child, 'exit')
  };

  child.stdout.on('data', (data) => {
    session.output += data;
  });
  child.stderr.on('data', (data) => {
    session.errors += data;
  });
  t.after(async () => {
    child.kill();
    await session.exited;
  });

  return session;
}

async function waitForOutput(session, text) {
  while (!session.output.includes(text)) {
    await Promise.race([
      once(session.child.stdout, 'data'),
      session.exited.then(() => {
        throw new Error(`wscat exited before ${text}: ${session.errors}`);
      })
    ]);
  }
}

async function send(session, socket, input) {
  const message = once(socket, 'message');

  session.child.stdin.write(input);
  return (await message)[0].toString();
}

for (const colors of [true, false]) {
  test(
    `--pretty starts enabled with colors ${colors ? 'on' : 'off'}`,
    { timeout: 10000 },
    async (t) => {
      const fixture = createFixture(t);
      const server = await createServer(t);
      const session = start(t, fixture, [
        '--pretty',
        ...(colors ? [] : ['--no-color']),
        '-c',
        `ws://127.0.0.1:${server.address().port}`
      ]);

      await waitForOutput(session, 'ready');

      const socket = [...server.clients][0];
      const payload = '{"id":9007199254740993,"ok":true}';

      session.output = '';
      socket.send(payload);
      await waitForOutput(session, '\n}');
      assert.ok(
        stripVTControlCharacters(session.output).includes(
          '< {\n  "id": 9007199254740993,\n  "ok": true\n}'
        )
      );
      if (colors) {
        assert.ok(session.output.includes('\u001b[36m"id"\u001b[39m'));
        assert.ok(session.output.includes('\u001b[35mtrue\u001b[39m'));
      } else {
        assert.doesNotMatch(session.output, /\u001b\[\d+m/);
      }

      session.child.stdin.write('\x14');
      await waitForOutput(session, 'JSON formatting off');
      session.output = '';
      socket.send(payload);
      await waitForOutput(session, payload);
      assert.ok(session.output.includes('< ' + payload));
      assert.strictEqual(session.errors, '');
    }
  );
}

test(
  'Ctrl+T enables formatting without --pretty and preserves the draft and cursor',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(t, fixture, [
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const socket = [...server.clients][0];
    const payload = '{"reply":true}';

    session.output = '';
    socket.send(payload);
    await waitForOutput(session, payload);
    assert.ok(session.output.includes('< ' + payload));
    session.child.stdin.write('{"kept":""}\x1b[D\x1b[D\x14');
    await waitForOutput(session, 'JSON formatting on');
    session.output = '';
    socket.send(payload);
    await waitForOutput(session, '\n}');
    assert.ok(
      stripVTControlCharacters(session.output).includes(
        '< {\n  "reply": true\n}'
      )
    );

    session.child.stdin.write('\x14');
    await waitForOutput(session, 'JSON formatting off');
    assert.strictEqual(
      await send(session, socket, 'value\r'),
      '{"kept":"value"}'
    );
    assert.deepStrictEqual(fs.readdirSync(fixture.directory), ['terminal.js']);
    assert.strictEqual(session.errors, '');
  }
);

test(
  '--pretty leaves piped output unchanged',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(
      t,
      fixture,
      ['--pretty', '-c', `ws://127.0.0.1:${server.address().port}`],
      { outputTTY: false }
    );

    await waitForOutput(session, 'ready');

    const payload = ' {"id":9007199254740993,"ok":true} ';

    session.output = '';
    [...server.clients][0].send(payload);
    await waitForOutput(session, payload);
    assert.strictEqual(session.output, payload + '\n');
  }
);

test(
  '--pretty keeps non-JSON and binary messages unchanged',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(t, fixture, [
      '--pretty',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const socket = [...server.clients][0];

    for (const payload of [
      'plain text',
      '{"broken":}',
      Buffer.from('{"binary":true}')
    ]) {
      session.output = '';
      socket.send(payload);
      await waitForOutput(session, payload.toString());
      assert.ok(session.output.includes('< ' + payload));
    }
  }
);

test(
  '--pretty formats --execute replies without color codes',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(t, fixture, [
      '--pretty',
      '--execute',
      'request',
      '--wait',
      '-1',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');
    session.output = '';
    [...server.clients][0].send('{"ok":true}');
    await waitForOutput(session, '\n}');
    assert.ok(
      stripVTControlCharacters(session.output).includes('{\n  "ok": true\n}')
    );
    assert.doesNotMatch(session.output, /\u001b\[\d+m|< /);
  }
);

test(
  '--pretty and Ctrl+T work in listen mode',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const reservation = await createServer(t);
    const port = reservation.address().port;

    await new Promise((resolve) => reservation.close(resolve));

    const session = start(t, fixture, ['--pretty', '--listen', String(port)]);

    await waitForOutput(session, 'Listening');

    const peer = new WebSocket(`ws://127.0.0.1:${port}`);

    t.after(() => peer.terminate());
    await once(peer, 'open');
    await waitForOutput(session, 'Client connected');
    session.output = '';
    peer.send('{"ok":true}');
    await waitForOutput(session, '\n}');
    assert.ok(
      stripVTControlCharacters(session.output).includes('< {\n  "ok": true\n}')
    );
    session.child.stdin.write('\x14');
    await waitForOutput(session, 'JSON formatting off');
    session.output = '';
    peer.send('{"ok":false}');
    await waitForOutput(session, '{"ok":false}');
    assert.ok(session.output.includes('< {"ok":false}'));
  }
);
