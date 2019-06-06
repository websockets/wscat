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

    -V, --version                 output the version number
    -l, --listen <port>           listen on port
    -c, --connect <url>           connect to a websocket server
    -p, --protocol <version>      optional protocol version
    -o, --origin <origin>         optional origin
    -x, --execute <command>       execute command after connecting
    -w, --wait <seconds>          wait given seconds after executing command
    --host <host>                 optional host
    -s, --subprotocol <protocol>  optional subprotocol (default: )
    -n, --no-check                Do not check for unauthorized certificates
    -H, --header <header:value>   Set an HTTP header. Repeat to set multiple. (--connect only) (default: )
    --auth <username:password>    Add basic HTTP authentication header. (--connect only)
    --ca <ca>                     Specify a Certificate Authority (--connect only)
    --cert <cert>                 Specify a Client SSL Certificate (--connect only)
    --key <key>                   Specify a Client SSL Certificate's key (--connect only)
    --passphrase [passphrase]     Specify a Client SSL Certificate Key's passphrase (--connect only). If you don't provide a value, it will be prompted for.
    --no-color                    Run without color
    --slash                       Enable slash commands for control frames (/ping, /pong, /close [code [, reason]])
    -h, --help                    output usage information
```

## Example

```
$ wscat -c ws://echo.websocket.org 
connected (press CTRL+C to quit)
> hi there
< hi there
> are you a happy parrot?
< are you a happy parrot?
```

## License

MIT
