# wscat

WebSocket cat.

## Installation

This module needs to be installed globally so use the `-g` flag when installing:

```
npm install -g wscat
```

## Usage

```
Usage: wscat [options] (--listen <port> | --connect <url>)

Options:
  -V, --version                       output the version number
  --auth <username:password>          add basic HTTP authentication header
  --ca <ca>                           specify a Certificate Authority (--connect only)
  --cert <cert>                       specify a Client SSL Certificate (--connect only)
  --history                           enable persistent command history for local runs
  --host <host>                       optional host
  --key <key>                         specify a Client SSL Certificate's key (--connect only)
  --max-redirects [num]               maximum number of redirects allowed (default: 10)
  --no-color                          run without color
  --no-history                        disable persistent command history
  --passphrase [passphrase]           specify a Client SSL Certificate Key's passphrase (--connect
                                      only). If you don't provide a value, it will be prompted for
  --proxy <[protocol://]host[:port]>  connect via a proxy. Proxy must support CONNECT method
  --slash                             enable slash commands for control frames (/ping [data], /pong
                                      [data], /close [code [, reason]]) (--connect only)
  -c, --connect <url>                 connect to a WebSocket server
  -H, --header <header:value>         set an HTTP header. Repeat to set multiple (--connect only)
                                      (default: [])
  -l, --listen <port>                 listen on port
  -L, --location                      follow redirects
  -n, --no-check                      do not check for unauthorized certificates (--connect only)
  -o, --origin <origin>               optional origin
  -p, --protocol <version>            optional protocol version
  -P, --show-ping-pong                print a notification when a ping or pong is received
                                      (--connect only)
  -s, --subprotocol <protocol>        optional subprotocol. Repeat to specify more than one
                                      (default: [])
  -w, --wait <seconds>                wait given seconds after executing command (-1 to hold open)
  -x, --execute <command>             execute command after connecting. Repeat to execute more than
                                      one (--connect only) (default: [])
  -h, --help                          display help for command
```

## Example

When `--connect` is given a host without a protocol, wscat assumes `ws://`. For
example, `wscat -c localhost:4000` connects to `ws://localhost:4000`. Specify
`wss://` explicitly when connecting over TLS.

```
$ wscat -c wss://websocket-echo.com
Connected (press CTRL+C to quit)
> hi there
< hi there
> are you a happy parrot?
< are you a happy parrot?
```

## Command history

Global npm and Bun installations save commands to `~/.wscat_history` during
interactive use. Each session loads the last 1,000 entries. For local runs, use
`--history` to save commands.

Use Up/Down to browse history. Press Ctrl+R, then type to search. Press Ctrl+R
again for an older match. Enter sends the command. Escape selects it for editing.
Ctrl+G cancels the search. Ctrl+C clears input and search text. At an empty
prompt, Ctrl+C closes the session.

The file stores plain text. Use `--no-history` for sensitive data. Piped input or
output and `--execute` do not use the file. If detection or file access fails,
wscat continues silently with history in memory.

## License

[MIT](LICENSE)
