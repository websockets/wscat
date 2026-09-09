'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const { once } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');
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
    preload,
    history: path.join(directory, '.wscat_history')
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
    [
      '--require',
      fixture.preload,
      options.filename || path.join(root, 'bin', 'wscat'),
      ...args
    ],
    {
      cwd: fixture.directory,
      env: {
        ...process.env,
        HOME: fixture.directory,
        USERPROFILE: fixture.directory,
        BUN_INSTALL: path.join(fixture.directory, '.bun'),
        BUN_INSTALL_GLOBAL_DIR: '',
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

test(
  'pasting inside JSON sends and stores the exact edited payload',
  {
    timeout: 10000
  },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(t, fixture, [
      '--history',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const before = '{"command":"account_info", "account": "';
    const after = '" }';
    const address = 'rwietsevLFg8XSmG3bEZzFein1g8RBZqWD';
    const expected = before + address + after;

    session.child.stdin.write(before + after);
    session.child.stdin.write('\x1b[D'.repeat(after.length));
    assert.strictEqual(
      await send(session, [...server.clients][0], address + '\r'),
      expected
    );
    assert.strictEqual(
      fs.readFileSync(fixture.history, 'utf8'),
      expected + '\n'
    );
    assert.strictEqual(session.errors, '');
  }
);

for (const prefix of [
  'localhost:',
  'LOCALHOST:',
  '127.0.0.1:',
  'ws://localhost:',
  'http://localhost:',
  'ws:localhost:',
  'http:localhost:'
]) {
  test(`connects to ${prefix}<port>`, { timeout: 10000 }, async (t) => {
    const fixture = createFixture(t);
    const host = prefix === '127.0.0.1:' ? '127.0.0.1' : 'localhost';
    const server = await createServer(t, host);
    const session = start(t, fixture, [
      '--no-history',
      '-c',
      `${prefix}${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');
    assert.strictEqual(
      await send(session, [...server.clients][0], 'hello\r'),
      'hello'
    );
    assert.strictEqual(session.errors, '');
  });
}

test(
  'a bare hostname and port preserve the path and query',
  {
    timeout: 10000
  },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t, 'localhost');
    const suffix = '/echo?next=ws://example.com:4000';
    const connection = once(server, 'connection');
    const session = start(t, fixture, [
      '--no-history',
      '-c',
      `localhost:${server.address().port}${suffix}`
    ]);
    const [socket, request] = await connection;

    await waitForOutput(session, 'ready');
    assert.strictEqual(request.url, suffix);
    assert.strictEqual(await send(session, socket, 'hello\r'), 'hello');
    assert.strictEqual(session.errors, '');
  }
);

test(
  'local CLI leaves stored history untouched by default',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);

    fs.writeFileSync(fixture.history, 'old command\n');

    const session = start(t, fixture, [
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const socket = [...server.clients][0];

    assert.strictEqual(await send(session, socket, '\u001b[A\n'), '');
    assert.strictEqual(
      await send(session, socket, 'new command\n'),
      'new command'
    );
    assert.strictEqual(
      await send(session, socket, '\u001b[A\n'),
      'new command'
    );
    assert.strictEqual(
      fs.readFileSync(fixture.history, 'utf8'),
      'old command\n'
    );
    assert.strictEqual(session.errors, '');
  }
);

test(
  'local --history recalls a previous process and saves /close before exit',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const args = [
      '--history',
      '--slash',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ];
    const first = start(t, fixture, args);

    await waitForOutput(first, 'ready');
    await send(first, [...server.clients][0], 'remember me\n');
    first.child.kill();
    await first.exited;

    const second = start(t, fixture, args);

    await waitForOutput(second, 'ready');

    const socket = [...server.clients].find(
      (client) => client.readyState === WebSocket.OPEN
    );

    assert.strictEqual(await send(second, socket, '\u001b[A\n'), 'remember me');
    second.child.stdin.write('/close\n');
    assert.strictEqual((await second.exited)[0], 0);
    assert.strictEqual(
      fs.readFileSync(fixture.history, 'utf8'),
      'remember me\n/close\n'
    );
  }
);

for (const manager of ['npm', 'bun']) {
  test(
    `${manager} global launcher enables history and --no-history disables it`,
    {
      skip: process.platform === 'win32',
      timeout: 10000
    },
    async (t) => {
      const fixture = createFixture(t);
      const server = await createServer(t);
      const prefix = path.join(
        fixture.directory,
        manager === 'npm' ? 'prefix' : '.bun'
      );
      const modules =
        manager === 'npm'
          ? path.join(prefix, 'lib', 'node_modules')
          : path.join(prefix, 'install', 'global', 'node_modules');
      const filename = path.join(prefix, 'bin', 'wscat');

      fs.mkdirSync(modules, { recursive: true });
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.symlinkSync(root, path.join(modules, 'wscat'));
      fs.symlinkSync(path.join(modules, 'wscat', 'bin', 'wscat'), filename);
      fs.writeFileSync(fixture.history, 'earlier command\n');

      const args = ['-c', `ws://127.0.0.1:${server.address().port}`];
      const first = start(t, fixture, args, { filename });

      await waitForOutput(first, 'ready');
      assert.strictEqual(
        await send(first, [...server.clients][0], '\u001b[A\n'),
        'earlier command'
      );
      await send(first, [...server.clients][0], 'global command\n');
      assert.strictEqual(
        fs.readFileSync(fixture.history, 'utf8'),
        'earlier command\nglobal command\n'
      );
      first.child.kill();
      await first.exited;

      const second = start(t, fixture, ['--no-history', ...args], { filename });

      await waitForOutput(second, 'ready');

      const socket = [...server.clients].find(
        (client) => client.readyState === WebSocket.OPEN
      );

      assert.strictEqual(await send(second, socket, '\u001b[A\n'), '');
      await send(second, socket, 'private command\n');
      assert.strictEqual(
        fs.readFileSync(fixture.history, 'utf8'),
        'earlier command\nglobal command\n'
      );
    }
  );
}

for (const options of [{ inputTTY: false }, { outputTTY: false }]) {
  test(
    `piped ${options.inputTTY === false ? 'input' : 'output'} leaves history untouched`,
    {
      timeout: 10000
    },
    async (t) => {
      const fixture = createFixture(t);
      const server = await createServer(t);

      fs.writeFileSync(fixture.history, 'old command\n');

      const session = start(
        t,
        fixture,
        ['--history', '-c', `ws://127.0.0.1:${server.address().port}`],
        options
      );

      await waitForOutput(session, 'ready');
      await send(session, [...server.clients][0], 'piped command\n');
      assert.strictEqual(
        fs.readFileSync(fixture.history, 'utf8'),
        'old command\n'
      );
    }
  );
}

test('--execute leaves history untouched', { timeout: 10000 }, async (t) => {
  const fixture = createFixture(t);
  const server = await createServer(t);

  fs.mkdirSync(fixture.history);

  const session = start(t, fixture, [
    '--history',
    '-c',
    `ws://127.0.0.1:${server.address().port}`,
    '-x',
    'executed command',
    '-w',
    '0'
  ]);

  assert.strictEqual((await session.exited)[0], 0);
  assert.strictEqual(session.errors, '');
  assert.ok(fs.statSync(fixture.history).isDirectory());
});

test(
  'local CLI does not create a history file',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(t, fixture, [
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');
    await send(session, [...server.clients][0], 'local command\n');
    assert.strictEqual(fs.existsSync(fixture.history), false);
  }
);

test('--listen restores and saves history', { timeout: 10000 }, async (t) => {
  const fixture = createFixture(t);
  const reservation = await createServer(t);
  const port = reservation.address().port;

  await new Promise((resolve) => reservation.close(resolve));
  fs.writeFileSync(fixture.history, 'earlier command\n');

  const session = start(t, fixture, ['--history', '--listen', String(port)]);

  await waitForOutput(session, 'Listening on port');

  const socket = new WebSocket(`ws://127.0.0.1:${port}`);

  t.after(() => socket.terminate());
  await once(socket, 'open');
  await waitForOutput(session, 'Client connected');
  assert.strictEqual(
    await send(session, socket, '\u001b[A\n'),
    'earlier command'
  );
  assert.strictEqual(
    await send(session, socket, 'server command\n'),
    'server command'
  );
  assert.strictEqual(
    fs.readFileSync(fixture.history, 'utf8'),
    'earlier command\nserver command\n'
  );
});

for (const operation of ['read', 'write']) {
  test(
    `history ${operation} failures are silent and do not interrupt the session`,
    { timeout: 10000 },
    async (t) => {
      const fixture = createFixture(t);
      const server = await createServer(t);

      if (operation === 'read') fs.mkdirSync(fixture.history);

      const session = start(t, fixture, [
        '--history',
        '--slash',
        '-c',
        `ws://127.0.0.1:${server.address().port}`
      ]);

      await waitForOutput(session, 'ready');
      if (operation === 'write') fs.mkdirSync(fixture.history);

      const socket = [...server.clients][0];

      assert.strictEqual(await send(session, socket, 'first\n'), 'first');
      fs.rmdirSync(fixture.history);
      assert.strictEqual(await send(session, socket, 'second\n'), 'second');
      assert.strictEqual(await send(session, socket, '\u001b[A\n'), 'second');
      assert.strictEqual(await send(session, socket, '\x12first\r'), 'first');
      session.child.stdin.write('/close\n');

      assert.strictEqual((await session.exited)[0], 0);
      assert.strictEqual(session.errors, '');
      assert.doesNotMatch(session.output, /warning:|error:/);
      assert.strictEqual(fs.existsSync(fixture.history), false);
    }
  );
}

test(
  'Ctrl+R searches saved history while incoming messages redraw the prompt',
  {
    timeout: 10000
  },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const saved = 'old apple\nunrelated\nrecent apple\n';

    fs.writeFileSync(fixture.history, saved);

    const session = start(t, fixture, [
      '--history',
      '--slash',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const socket = [...server.clients][0];
    const received = [];

    socket.on('message', (data) => received.push(data.toString()));
    session.child.stdin.write('\x12apple');
    await waitForOutput(session, "(reverse-i-search)`apple': recent apple");
    session.output = '';
    socket.send('message during search');
    await waitForOutput(session, "(reverse-i-search)`apple': recent apple");

    assert.ok(session.output.includes('< message during search'));
    assert.deepStrictEqual(received, []);
    assert.strictEqual(fs.readFileSync(fixture.history, 'utf8'), saved);
    assert.strictEqual(await send(session, socket, '\x12\r'), 'old apple');
    assert.strictEqual(
      fs.readFileSync(fixture.history, 'utf8'),
      saved + 'old apple\n'
    );
    session.child.stdin.write('/close\r');
    assert.strictEqual((await session.exited)[0], 0);
    assert.strictEqual(session.errors, '');
  }
);

test(
  'Ctrl+C cancels input without sending or saving it and closes an empty prompt',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const saved = 'saved command\n';

    fs.writeFileSync(fixture.history, saved);

    const session = start(t, fixture, [
      '--history',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const socket = [...server.clients][0];
    const received = [];

    socket.on('message', (data) => received.push(data.toString()));

    for (const keys of ['draft', '\x12saved', '\x12missing']) {
      session.child.stdin.write(keys + '\x03');
      assert.strictEqual(await send(session, socket, 'kept\r'), 'kept');
      assert.strictEqual(
        fs.readFileSync(fixture.history, 'utf8'),
        saved + 'kept\n'
      );
    }

    assert.deepStrictEqual(received, ['kept', 'kept', 'kept']);
    session.child.stdin.write('\x12kept\x03\x03');
    assert.strictEqual((await session.exited)[0], 0);
    assert.strictEqual(
      fs.readFileSync(fixture.history, 'utf8'),
      saved + 'kept\n'
    );
    assert.strictEqual(session.errors, '');
  }
);

test(
  'Ctrl+R works with persistence disabled',
  { timeout: 10000 },
  async (t) => {
    const fixture = createFixture(t);
    const server = await createServer(t);
    const session = start(t, fixture, [
      '--no-history',
      '-c',
      `ws://127.0.0.1:${server.address().port}`
    ]);

    await waitForOutput(session, 'ready');

    const socket = [...server.clients][0];

    await send(session, socket, 'old apple\r');
    await send(session, socket, 'recent apple\r');
    assert.strictEqual(
      await send(session, socket, '\x12apple\x12\r'),
      'old apple'
    );
    assert.strictEqual(fs.existsSync(fixture.history), false);
  }
);

for (const failure of ['throw', 'empty', 'relative', 'missing', 'detection']) {
  test(
    `unavailable history location (${failure}) silently keeps in-memory history`,
    { timeout: 10000 },
    async (t) => {
      const fixture = createFixture(t);
      const server = await createServer(t);
      let preload;

      if (failure === 'detection') {
        const filename = path.join(root, 'lib', 'is-global-install');

        preload =
          `const filename = require.resolve(${JSON.stringify(filename)});\n` +
          'require(filename);\n' +
          'require.cache[filename].exports = () => {\n' +
          "  throw new Error('Installation lookup failed');\n" +
          '};\n';
      } else if (failure === 'throw') {
        preload =
          "require('os').homedir = () => {\n" +
          "  throw new Error('Home lookup failed');\n" +
          '};\n';
      } else {
        const home =
          failure === 'empty'
            ? ''
            : failure === 'relative'
              ? '.'
              : path.join(fixture.directory, 'missing');

        preload = `require('os').homedir = () => ${JSON.stringify(home)};\n`;
      }

      fs.appendFileSync(fixture.preload, preload);

      const args = ['--slash', '-c', `ws://127.0.0.1:${server.address().port}`];

      if (failure !== 'detection') args.push('--history');

      const session = start(t, fixture, args);

      await waitForOutput(session, 'ready');

      const socket = [...server.clients][0];

      assert.strictEqual(await send(session, socket, 'hello\n'), 'hello');
      assert.strictEqual(await send(session, socket, '\u001b[A\n'), 'hello');
      session.child.stdin.write('/close\n');

      assert.strictEqual((await session.exited)[0], 0);
      assert.strictEqual(session.errors, '');
      assert.doesNotMatch(session.output, /warning:|error:/);
      assert.strictEqual(fs.existsSync(fixture.history), false);
      assert.strictEqual(
        fs.existsSync(path.join(fixture.directory, 'missing')),
        false
      );
    }
  );
}
