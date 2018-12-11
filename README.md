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
$ wscat -c ws://echo.websocket.org 
connected (press CTRL+C to quit)
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
