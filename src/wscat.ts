/*

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

*/

import * as WebSocket from 'ws'
import {WebSocketStream} from './stream'

export interface IOptions {
    binary: boolean
    inputStream: NodeJS.ReadableStream
    reportClose: boolean
    useRaw: boolean
    keepOpen: boolean
    outputStream: NodeJS.WritableStream
    perMessageDeflate: boolean
    protocol: string
}

export interface IConnectOptions extends IOptions {
    address: string
    headers: { [key: string]: string; }
    rejectUnauthorized: boolean
}

export interface IListenOptions extends IOptions {
    port: number
}

function setup(options: IOptions, socket: WebSocket) {
    const stream = new WebSocketStream(socket, options)

    stream.pipe(options.outputStream)
    if (socket.readyState === WebSocket.CONNECTING) {
        socket.on('open', () => { options.inputStream.pipe(stream) })
    } else {
        options.inputStream.pipe(stream)
    }

    if (options.inputStream === process.stdin && process.stdin.isTTY) {
        if (options.useRaw) {
            (process.stdin as any).setRawMode(true)
        }
    }

    stream.on('close', (code: number, reason: string) => {
        if (options.reportClose) {
            process.stdout.write(`${code}:${reason}\n`)
        }

        if (options.inputStream === process.stdin && process.stdin.isTTY) {
            if (options.useRaw) {
                (process.stdin as any).setRawMode(false)
            }
            process.exit()
        }
    })
    stream.on('finish', (e) => {
        if (!options.keepOpen && stream.hasWritten) {
            socket.close()
        }
    })
}

export function connect(options: IConnectOptions) {
    const socket = new WebSocket(options.address, options)
    setup(options, socket)
}

export function listen(options: IListenOptions) {
    const serverOptions = {
        clientTracking: false,
        perMessageDeflate: options.perMessageDeflate,
        port: options.port,
    }
    const server = new WebSocket.Server(serverOptions)
    server.once('connection', (socket: WebSocket) => {
        server.close()
        setup(options, socket)
    })
}
