import { SerialPort } from 'serialport';
import { EventEmitter } from 'node:events';
import { SerialHandlerEvents } from '../types/serialHandlerEvents';
import logger from '../logger';
import { IncomingCommand, OutgoingCommand } from '../types/commands';

export class SerialHandler extends EventEmitter<SerialHandlerEvents> {
    connected = false;
    port: SerialPort;
    constructor(serialPortPath: string, baudRate = 115200) {
        super();
        this.port = new SerialPort({
            path: serialPortPath,
            baudRate,
            autoOpen: false,
        });

        this.port.once('open', () => {
            logger.debug(`Port ${serialPortPath} opened`);
            this.connected = true;
            this.emit('connect');
        });

        let partialData = '';
        this.port.on('data', (rawDataBuffer: Buffer) => {
            const rawData = partialData + rawDataBuffer.toString();
            // logger.debug(`Data: ${rawData}`);

            if (rawData.includes('\n')) { // we got at least one whole data packet
                const dataSplitted = rawData.split('\n');
                partialData = dataSplitted.pop() ?? '';
                for (const data of dataSplitted) this.handleData(data);
            } else partialData = rawData;
        });

        this.port.on('error', (error) => {
            this.connected = false;
            this.emit('error', error);
        });

        this.port.on('close', () => {
            this.connected = false;
            this.emit('disconnect');
        });

        this.port.open((error) => {
            if (error) this.emit('error', error);
        });
    }

    sendCommand(command: OutgoingCommand, ...args: (string | number)[]): void {
        logger.debug(`Sending command ${command} -> ${args.join(' ')}`);
        this.port.write(`${command}${args?.length ? (args.map(a => typeof a === 'string' ? Buffer.from(a).toString('base64') : a).join(':')) : ''}\n`);
    }

    private handleData(data: string): void {
        const dataSplitted = data.slice(1).split(':');
        const command = data.charAt(0) as IncomingCommand;

        logger.debug(`Data ${command} -> ${dataSplitted.join(' ')}`);

        if (command === '=') {
            this.emit('potsValues', ...dataSplitted.map(Number));
        } else {
            this.emit('data', ...[command, ...dataSplitted]);
        }
    }
};