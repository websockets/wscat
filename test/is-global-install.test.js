'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');

const isGlobalInstall = require('../lib/is-global-install');

function createFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wscat-install-'));

  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  return directory;
}

function writeScript(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, '');
  return filename;
}

function linkScript(target, filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.symlinkSync(target, filename);
  return filename;
}

test('direct scripts and missing launchers are local', (t) => {
  const directory = createFixture(t);
  const filename = writeScript(path.join(directory, 'bin', 'wscat'));

  assert.strictEqual(isGlobalInstall(filename), false);
  assert.strictEqual(isGlobalInstall(path.join(directory, 'missing')), false);
  assert.strictEqual(isGlobalInstall(undefined), false);
});

test('local dependencies and npx-style launchers are local', (t) => {
  const directory = createFixture(t);
  const filename = writeScript(
    path.join(directory, 'node_modules', 'wscat', 'bin', 'wscat')
  );

  assert.strictEqual(isGlobalInstall(filename), false);
  if (process.platform === 'win32') return;

  const launcher = linkScript(
    filename,
    path.join(directory, 'node_modules', '.bin', 'wscat')
  );

  assert.strictEqual(isGlobalInstall(launcher), false);
});

test('recognizes npm global installations with a custom prefix', (t) => {
  const directory = createFixture(t);

  if (process.platform === 'win32') {
    const filename = writeScript(
      path.join(directory, 'node_modules', 'wscat', 'bin', 'wscat')
    );

    fs.writeFileSync(path.join(directory, 'wscat.cmd'), '');
    assert.strictEqual(isGlobalInstall(filename), true);
    return;
  }

  const filename = writeScript(
    path.join(directory, 'lib', 'node_modules', 'wscat', 'bin', 'wscat')
  );
  const launcher = linkScript(filename, path.join(directory, 'bin', 'wscat'));

  assert.strictEqual(isGlobalInstall(launcher), true);
  assert.strictEqual(isGlobalInstall(filename), false);
});

test('recognizes Bun global installations with a configured directory', (t) => {
  const directory = createFixture(t);
  const previous = process.env.BUN_INSTALL_GLOBAL_DIR;

  process.env.BUN_INSTALL_GLOBAL_DIR = path.join(directory, 'global');
  t.after(() => {
    if (previous === undefined) delete process.env.BUN_INSTALL_GLOBAL_DIR;
    else process.env.BUN_INSTALL_GLOBAL_DIR = previous;
  });

  const filename = writeScript(
    path.join(directory, 'global', 'node_modules', 'wscat', 'bin', 'wscat')
  );

  if (process.platform === 'win32') {
    assert.strictEqual(isGlobalInstall(filename), true);
    return;
  }

  const launcher = linkScript(filename, path.join(directory, 'bin', 'wscat'));

  assert.strictEqual(isGlobalInstall(launcher), true);
  assert.strictEqual(isGlobalInstall(filename), false);
});

test(
  'a globally linked checkout stays local when invoked directly',
  {
    skip: process.platform === 'win32'
  },
  (t) => {
    const directory = createFixture(t);
    const checkout = path.join(directory, 'checkout');
    const filename = writeScript(path.join(checkout, 'bin', 'wscat'));

    fs.mkdirSync(path.join(directory, 'lib', 'node_modules'), {
      recursive: true
    });
    fs.symlinkSync(
      checkout,
      path.join(directory, 'lib', 'node_modules', 'wscat')
    );

    const launcher = linkScript(filename, path.join(directory, 'bin', 'wscat'));

    assert.strictEqual(isGlobalInstall(launcher), true);
    assert.strictEqual(isGlobalInstall(filename), false);
  }
);
