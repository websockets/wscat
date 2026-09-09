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

async function createServer(t) {
  const server = new WebSocket.Server({ port: 0, host: '127.0.0.1' });

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
