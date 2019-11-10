# wscat

WebSocket cat.

## Installation

This module needs to be installed globally so use the `-g` flag when installing:

```
npm install -g wscat
```

## Usage

### Connect
```
Usage: wscat [options] (--listen <port> | --connect <url>)

Options:
  -V, --version                       output the version number
  -l, --listen <port>                 listen on port
  -c, --connect <url>                 connect to a WebSocket server
  -p, --protocol <version>            optional protocol version
  -o, --origin <origin>               optional origin
  -x, --execute <command>             execute command after connecting
  -w, --wait <seconds>                wait given seconds after executing command
  --host <host>                       optional host
  -s, --subprotocol <protocol>        optional subprotocol (default: [])
  -n, --no-check                      do not check for unauthorized certificates
  -H, --header <header:value>         set an HTTP header. Repeat to set multiple (--connect only) (default: [])
  --auth <username:password>          add basic HTTP authentication header (--connect only)
  --ca <ca>                           specify a Certificate Authority (--connect only)
  --cert <cert>                       specify a Client SSL Certificate (--connect only)
  --key <key>                         specify a Client SSL Certificate's key (--connect only)
  --passphrase [passphrase]           specify a Client SSL Certificate Key's passphrase (--connect only). If you don't provide a value, it will be prompted for
  --no-color                          run without color
  --slash                             enable slash commands for control frames (/ping, /pong, /close [code [, reason]])
  --proxy <[protocol://]host[:port]>  connect via a proxy. Proxy must support CONNECT method
  -h, --help                          output usage information
```

## Example

```
$ wscat -c ws://echo.websocket.org
Connected (press CTRL+C to quit)
> hi there
< hi there
> are you a happy parrot?
< are you a happy parrot?
```

### Control Frames
To issue control frames, start wscat with `--slash`, i.e.
```
$ wscat --slash -c ws://echo.websocket.org
connected (press CTRL+C to quit)
> /ping
< Received pong
```

By default wscat will print to console when it recieves a ping, which can mess
up the users typing, i.e.
```
$ wscat -c ws://echo.websocket.org
connected (press CTRL+C to quit)
< Received ping
< Received ping
            < Received ping
> w are youHello user ho 		# Typed Hello user how are you
< Received ping
```

By using `--quiet` pings will be recieved and a pong will be sent back in the
background, and not be printed to console. All other control frames will be
visible, i.e.
```
$ wscat --slash --quiet --ws://echo.websocket.org
> Hello
> /ping
< Received pong
> How are you?
> 'Look ma, know ping messages'
```

## License

MIT
