'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function realpath(filename) {
  try {
    return fs.realpathSync(filename);
  } catch (err) {
    return undefined;
  }
}

/**
 * Recognize global launchers without running a package manager at startup.
 * Unrecognized installations can opt in with `--history`.
 *
 * @param {String} filename The invoked executable path
 * @return {Boolean} Whether the executable is a global installation
 */
function isGlobalInstall(filename) {
  if (!filename) return false;

  filename = path.resolve(filename);

  const directory = realpath(path.dirname(filename));
  const target = realpath(filename);

  if (!directory || !target || path.basename(directory) === '.bin')
    return false;

  // Direct script invocations, including a globally linked checkout, stay local.
  if (
    process.platform !== 'win32' &&
    path.join(directory, path.basename(filename)) === target
  ) {
    return false;
  }

  const bunRoot = process.env.BUN_INSTALL || path.join(os.homedir(), '.bun');
  const bunGlobal =
    process.env.BUN_INSTALL_GLOBAL_DIR ||
    path.join(bunRoot, 'install', 'global');
  const bunScript = path.join(
    bunGlobal,
    'node_modules',
    'wscat',
    'bin',
    'wscat'
  );

  if (process.platform === 'win32') {
    // npm's Windows shims invoke the script directly instead of using symlinks.
    const prefix = path.resolve(directory, '..', '..', '..');
    const npmScript = path.join(
      prefix,
      'node_modules',
      'wscat',
      'bin',
      'wscat'
    );

    return (
      target === realpath(bunScript) ||
      (target === realpath(npmScript) &&
        fs.existsSync(path.join(prefix, 'wscat.cmd')))
    );
  }

  const npmScript = path.resolve(
    directory,
    '..',
    'lib',
    'node_modules',
    'wscat',
    'bin',
    'wscat'
  );

  return target === realpath(npmScript) || target === realpath(bunScript);
}

module.exports = isGlobalInstall;
