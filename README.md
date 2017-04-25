
wscat2 [![Build Status](https://travis-ci.org/jnordberg/wscat.svg?branch=master)](https://travis-ci.org/jnordberg/wscat)
======

Unix-style WebSocket cat (or netcat for websockets).


Installation
------------

```
npm install -g wscat2
```

Usage
-----

```
$ wscat -h
usage: wscat [-h] [-v] [-l PORT] [-b] [-k] [-d] [address]

Positional arguments:
  address

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  -l PORT, --listen PORT
                        Start a websocket server on PORT.
  -b, --binary          Use binary WebSockets.
  -k, --keep-open       Do not close the socket after EOF.
  -d, --deflate         Use per-message deflate.

```

Examples
--------

If you ever used `nc`, `wscat` works pretty much the same.

### Connect to a server

```
$ wscat echo.websocket.org
Hello
Hello
Who's there?
Who's there?
^D

```

### Chat

Server:

```
$ wscat -l 12345
Hi there!
Hi!
It's nice to speak to someone who just dosn't repeat everything I say back at me.
Yeah! Isn't it?!
Sorry, gotta run...
^D

```

Client:

```
$ wscat localhost:12345
Hi there!
Hi!
It's nice to speak to someone who just dosn't repeat everything I say back at me.
Yeah! Isn't it?!
Sorry, gotta run...
```

### Transfer a file

Server:

```
$ wscat -b -l 12345 < ~/Desktop/mycat.jpg
```

Client:

```
$ wscat -b localhost:12345 > igotacat.jpg
```

Note that you can have the client send the file as well, after the connection has been setup `wscat` does not differentiate between server/client.

### Get your bitcoin on

```
$ echo '{"op":"unconfirmed_sub"}' | wscat -k wss://ws.blockchain.info/inv
```

The `-k` option is used to keep the socket open after the command has been sent, allowing us to read the continuous stream of bitcoin transactions.


License
-------

[BSD 3-Clause](https://tldrlegal.com/license/bsd-3-clause-license-(revised))

---

```

       /\_/\                    /\_/\
      / 0 0 \                  / o o \
     ====v====                ====C====          __   __
      \  W  /                  \  V  /         _(  )_(  )_
      |     |     _            |     |     .-=(_   WEB  _)
      / ___ \    /             / ___ \    /     (__   __)
     / /   \ \  |             / /   \ \  |        (__)
    (((-----)))-'            (((-----)))-'
     /                        /
    (      ___      ___      /
     \__.=|___|E    3__|=.__/
            /       ^

```
