#!/usr/bin/env ts-node

import {ArgumentParser} from 'argparse'
import version from './version'
import * as wscat from './wscat'

interface ICLIOptions {
    address?: string
    binary: boolean
    reportClose: boolean
    useRaw: boolean
    deflate: boolean
    keepOpen: boolean
    listen?: number
    noCheck: boolean
    subProto?: string
    header: string[]
}

const parser = new ArgumentParser({version, addHelp: true})

parser.addArgument(['-l', '--listen'], {
    help: 'Start a websocket server on PORT.',
    metavar: 'PORT',
    type: Number,
})

parser.addArgument(['-b', '--binary'], {
    action: 'storeTrue',
    defaultValue: false,
    help: 'Use binary WebSockets.',
})

parser.addArgument(['-c', '--report-close'], {
    action: 'storeTrue',
    defaultValue: false,
    dest: 'reportClose',
    help: 'Write WebSocket $close:$reason to STDERR on close.',
})

parser.addArgument(['-r', '--raw'], {
    action: 'storeTrue',
    defaultValue: false,
    dest: 'useRaw',
    help: 'Use rawmode stdin.',
})

parser.addArgument(['-H', '--header'], {
    action: 'append',
    help: 'Specify a custom HTTP request header. May be given multiple times.',
})

parser.addArgument(['-n', '--no-check'], {
    action: 'storeTrue',
    defaultValue: false,
    dest: 'noCheck',
    help: 'Do not check for unauthorized certificates.',
})

parser.addArgument(['-k', '--keep-open'], {
    action: 'storeTrue',
    defaultValue: false,
    dest: 'keepOpen',
    help: 'Do not close the socket after EOF.',
})

parser.addArgument(['-d', '--deflate'], {
    action: 'storeTrue',
    defaultValue: false,
    help: 'Use per-message deflate.',
})

parser.addArgument(['-s', '--subprotocol'], {
    dest: 'subProto',
    help: 'WebSocket subprotocol',
    metavar: 'SUBP',
    type: String,
})

parser.addArgument(['address'], {
    nargs: '?',
    type: String,
})

const args = parser.parseArgs() as ICLIOptions

const headers: any = {}
if (args.header) {
    args.header.forEach( (txt) => {
        const match = txt.match(/(.+?)\s*:\s*(.+)/)

        if (match) {
            headers[ match[1] ] = match[2]
        }
    } )
}

const options: any = {
    binary: args.binary,
    headers,
    inputStream: process.stdin,
    keepOpen: args.keepOpen,
    outputStream: process.stdout,
    perMessageDeflate: args.deflate,
    protocol: args.subProto,
    rejectUnauthorized: !args.noCheck,
    reportClose: args.reportClose,
    useRaw: args.useRaw,
}

if (args.address) {
    if (args.listen) {
        throw new Error('Can not use --listen option in conjunction with address')
    }
    if (!hasProtocol(args.address)) {
        args.address = `ws://${ args.address }`
    }
    options.address = args.address
    wscat.connect(options)
} else if (args.listen) {
    options.port = args.listen
    wscat.listen(options)
} else {
    parser.printHelp()
}

function hasProtocol(url: string): boolean {
    const pattern = /^[a-z]+:\/\//i
    return pattern.test(url)
}
