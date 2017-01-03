# wscatverbose

WebSocket cat. This is the same as https://github.com/websockets/wscat but this version displays flags of the messages which contain the buffer as well, sometimes handy for debugging


## Installation

This module needs to be installed globally so use the `-g` flag when installing:

```
npm install -g wscatverbose
```

## Usage

```
$ wscatverbose -c ws://echo.websocket.org 
connected (press CTRL+C to quit)
> hi there
< hi there
> are you a happy parrot?
< are you a happy parrot?
```

## License

MIT
