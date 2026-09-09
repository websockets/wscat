'use strict';

const assert = require('assert');
const { test } = require('node:test');
const { stripVTControlCharacters } = require('util');

const formatJson = require('../lib/format-json');

test('JSON formatting indents nested objects and arrays with two spaces', () => {
  const input = '{"result":{"items":[1,{"ok":true},[],{}]},"empty":{}}';
  const expected = `{
  "result": {
    "items": [
      1,
      {
        "ok": true
      },
      [],
      {}
    ]
  },
  "empty": {}
}`;

  assert.strictEqual(formatJson(input, false), expected);
  assert.strictEqual(formatJson(expected, false), expected);
});

test('JSON formatting preserves large numbers, duplicate keys and key order', () => {
  const input =
    '{"2":9007199254740993,"1":-0,"2":1.2300e+400,"n":-0.000001E-1000}';

  assert.strictEqual(
    formatJson(input, false),
    '{\n  "2": 9007199254740993,\n  "1": -0,\n' +
      '  "2": 1.2300e+400,\n  "n": -0.000001E-1000\n}'
  );
});

test('JSON strings keep escapes, Unicode, spaces and punctuation intact', () => {
  const input = String.raw`{"text":"héllo 世界 🍎  [{}],: true 12","quote":"a\"b\\c","escape":"\u001b[31m\n\t\u0061"}`;
  const expected = [
    '{',
    '  "text": "héllo 世界 🍎  [{}],: true 12",',
    String.raw`  "quote": "a\"b\\c",`,
    String.raw`  "escape": "\u001b[31m\n\t\u0061"`,
    '}'
  ].join('\n');

  assert.strictEqual(formatJson(input, false), expected);
  assert.strictEqual(
    stripVTControlCharacters(formatJson(input, true)),
    expected
  );
});

test('JSON formatting supports empty containers and scalar values', () => {
  for (const input of [
    '{}',
    '[]',
    '42',
    '-0',
    'true',
    'false',
    'null',
    '"text"'
  ]) {
    assert.strictEqual(formatJson(' \r\n' + input + '\t ', false), input);
  }
});

test('invalid JSON and other messages stay unchanged', () => {
  for (const input of ['', ' ', 'hello', '{oops}', '[1,]', '{}{}', 'null\0']) {
    assert.strictEqual(formatJson(input, false), input);
    assert.strictEqual(formatJson(input, true), input);
  }
});

test('JSON colors distinguish keys, strings, numbers, booleans and null', () => {
  const input = '{"key":"text","n":12,"yes":true,"no":false,"nil":null}';
  const result = formatJson(input, true);

  for (const [token, color] of [
    ['"key"', 36],
    ['"text"', 32],
    ['12', 33],
    ['true', 35],
    ['false', 35],
    ['null', 90]
  ]) {
    assert.ok(result.includes(`\u001b[${color}m${token}\u001b[39m`));
  }
  assert.strictEqual(
    stripVTControlCharacters(result),
    formatJson(input, false)
  );
});
