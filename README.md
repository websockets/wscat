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

```
$ wscat -c wss://websocket-echo.com
Connected (press CTRL+C to quit)
> hi there
< hi there
> are you a happy parrot?
< are you a happy parrot?
```

## Command history

When launched through a global npm or Bun installation, interactive sessions save
submitted messages and slash commands to `~/.wscat_history`. Local installations
and scripts run directly from a checkout keep history in memory and do not access
that file unless `--history` is passed:

```
node bin/wscat --history -c wss://websocket-echo.com
```

Use the Up and Down arrow keys to browse commands from the current and previous
sessions, in both `--connect` and `--listen` mode. When persistence is enabled, the
latest 1,000 entries are available in each new session. Empty lines and
consecutive duplicates are skipped.

Press Ctrl+R and type part of a command to search history from newest to oldest.
Press Ctrl+R again to find the next older match. Backspace edits the search text.
Enter sends the selected command; Escape returns to the normal prompt so you can
edit it first. Ctrl+G cancels the search and restores the line you were typing.
Searching also works with in-memory history when persistence is disabled.

Commands are appended immediately, one per line, so concurrent sessions can share
the file. The file is not automatically truncated; delete or edit it between
sessions to clear or trim saved history. New files are readable and writable only
by their owner on systems that support Unix file permissions. History is stored
in plain text, so use `--no-history` when sending sensitive data. This option
disables reading and writing the file while retaining history within the current
session. Piped input or output and `--execute` commands do not access the history
file.

Global installation detection supports npm's global launcher layout (including
custom prefixes) and Bun's default global directory, `BUN_INSTALL`, or
`BUN_INSTALL_GLOBAL_DIR`. For other installation layouts, use `--history` to
enable persistence explicitly.

If the global installation or home directory cannot be determined, or the history
file cannot be read or written, wscat silently continues with history in memory.

## License

[MIT](LICENSE)
