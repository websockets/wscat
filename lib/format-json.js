'use strict';

/**
 * Format valid JSON without changing numbers, keys, or string escapes.
 *
 * @param {String} text The received message
 * @param {Boolean} colors Whether to add terminal colors
 * @return {String} The formatted JSON or the original message
 */
function formatJson(text, colors) {
  try {
    JSON.parse(text);
  } catch (err) {
    return text;
  }

  // Validate first, then keep the original tokens to avoid rounding numbers.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g);
  let depth = 0;

  return tokens
    .map((token, i) => {
      switch (token) {
        case '{':
        case '[':
          depth++;
          return (
            token +
            (tokens[i + 1] === '}' || tokens[i + 1] === ']'
              ? ''
              : '\n' + '  '.repeat(depth))
          );
        case '}':
        case ']':
          depth--;
          return (
            (tokens[i - 1] === '{' || tokens[i - 1] === '['
              ? ''
              : '\n' + '  '.repeat(depth)) + token
          );
        case ',':
          return ',\n' + '  '.repeat(depth);
        case ':':
          return ': ';
        default: {
          if (!colors) return token;

          let color = 33;

          if (token[0] === '"') color = tokens[i + 1] === ':' ? 36 : 32;
          else if (token === 'null') color = 90;
          else if (token === 'true' || token === 'false') color = 35;

          return `\u001b[${color}m${token}\u001b[39m`;
        }
      }
    })
    .join('');
}

module.exports = formatJson;
