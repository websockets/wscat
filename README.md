# wscat

WebSocket cat.

## Installation

This module needs to be installed globally so use the `-g` flag when installing:

```
npm install -g wscat
```
## Help
```
Usage: wscat [options] (--listen <port> | --connect <url>)

  Options:

    -h, --help                    output usage information
    -V, --version                 output the version number
    -l, --listen <port>           listen on port
    -c, --connect <url>           connect to a websocket server
    -m, --message <message>       initial message to send
    -p, --protocol <version>      optional protocol version
    -o, --origin <origin>         optional origin
    --host <host>                 optional host
    -s, --subprotocol <protocol>  optional subprotocol
    -n, --no-check                Do not check for unauthorized certificates
    -H, --header <header:value>   Set an HTTP header. Repeat to set multiple. (--connect only)
    --auth <username:password>    Add basic HTTP authentication header. (--connect only)
    -r, --retry                   Retry on disconnection. (--connect only)
    -k, --keepalive <interval>    send a ping every interval seconds
    -P, --parsecommands           parse input for commands (send, ping, pong, close, etc.)
```
## Examples

### Using original behavior:
```
$wscat -c wss://echo.websocket.org

connected (press CTRL+C to terminate)
> hello
< hello
```
### Using --parsecommands
```
$wscat -c wss://echo.websocket.org --parsecommands

connected (press CTRL+C to terminate)
'> send <message>' to send <message> to server
'> ping' to send a ping to the server
'> pong' to send pong to the server
'> close' to gracefully close connection to the server
'> last' to reprint last received message
'> counts' to print frame counts
>
>
> ping

ping sent

pong Received
> send hello

sent (hello)

< hello
> counts
Connection Open for 67305 ms
1 message(s) Received
1 message(s) Sent
0 ping(s) Received
1 ping(s) Sent
1 pong(s) Received
0 pong(s) Sent
Last Message Received =
hello
> close
Connection Closed
Connection Open for 102873 ms
1 message(s) Received
1 message(s) Sent
0 ping(s) Received
1 ping(s) Sent
1 pong(s) Received
0 pong(s) Sent
Last Message Received =
hello
> ConnectionLasted: 102883ms
```

## License

MIT
