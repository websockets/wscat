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
  --auth <username:password>          add basic HTTP authentication header (--connect only)
  --ca <ca>                           specify a Certificate Authority (--connect only)
  --cert <cert>                       specify a Client SSL Certificate (--connect only)
  --host <host>                       optional host
  --key <key>                         specify a Client SSL Certificate's key (--connect only)
  --max-redirects [num]               maximum number of redirects allowed (--connect only) (default: 10)
  --no-color                          run without color
  --passphrase [passphrase]           specify a Client SSL Certificate Key's passphrase (--connect only). If you don't
                                      provide a value, it will be prompted for
  --proxy <[protocol://]host[:port]>  connect via a proxy. Proxy must support CONNECT method
  --slash                             enable slash commands for control frames (/ping [data], /pong [data], /close
                                      [code [, reason]])
  -c, --connect <url>                 connect to a WebSocket server
  -H, --header <header:value>         set an HTTP header. Repeat to set multiple (--connect only) (default: [])
  -L, --location                      follow redirects (--connect only)
  -l, --listen <port>                 listen on port
  -n, --no-check                      do not check for unauthorized certificates
  -o, --origin <origin>               optional origin
  -p, --protocol <version>            optional protocol version
  -P, --show-ping-pong                print a notification when a ping or pong is received
  -s, --subprotocol <protocol>        optional subprotocol (default: [])
  -w, --wait <seconds>                wait given seconds after executing command
  -x, --execute <command>             execute command after connecting
  -h, --help                          display help for command
```

## Example

```
$ wscat -c ws://websocket-echo.com
Connected (press CTRL+C to quit)
> hi there
< hi there
> are you a happy parrot?
< are you a happy parrot?
```

## License

[MIT](LICENSE)
