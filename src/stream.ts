import {Duplex} from 'stream'
import * as WebSocket from 'ws'

export interface IWebSocketStreamOptions {
    binary: boolean
}

export class WebSocketStream extends Duplex {

    public hasWritten: boolean = false

    constructor(private socket: WebSocket, readonly options: IWebSocketStreamOptions) {
        super({
            decodeStrings: !options.binary,
            encoding: options.binary ? undefined : 'utf-8',
        })
        socket.on('message', this.messageHandler)
        socket.on('error', (error: Error) => {
            this.emit('error', error)
        })
        socket.on('close', (code, reason) => {
            this.push(null)
            this.emit('close', code, reason)
        })
    }

    public _write(chunk: any, encoding: string, callback: (error?: Error) => void) {
        this.hasWritten = true
        this.socket.send(chunk, this.options, callback)
    }

    public _read(size: number) {}

    private messageHandler = (data: any, flags: {binary: boolean}) => {
        this.push(data)
    }
}
