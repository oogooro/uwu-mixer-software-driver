import { SerialPort } from 'serialport';
import { EventEmitter } from 'node:events';
import { SerialHandlerEvents } from '../types/serialHandlerEvents';
import logger from '../logger';
import { DataType } from '../types/commandTypes';

export class SerialHandler extends EventEmitter<SerialHandlerEvents> {
    private queryCollector: (value: string[] | PromiseLike<string[]>) => void;
    private queryCollectorAttached = false;
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
            logger.debug(`Data: ${rawData}`);

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

    private handleData(data: string): void {
        const dataSplitted = data.split(':');
        const dataType = dataSplitted.shift() as DataType;

        logger.debug(`Data ${dataType} -> ${dataSplitted.join(' ')}`);

        if (dataType === '#') {
            this.emit('command', ...dataSplitted);
        } else if (dataType === '=') {
            this.emit('potsValues', ...dataSplitted.map(Number));
        } else if (dataType === '!') {
            if (!this.queryCollectorAttached) {
                logger.log({
                    level: 'warn',
                    message: 'Recieved unexpected query response',
                    color: 'yellowBright',
                });
            } else {
                this.queryCollectorAttached = false;
                this.queryCollector(dataSplitted);
            }
        } else {
            logger.log({
                level: 'warn',
                message: 'Unknown data type',
                color: 'yellowBright',
            });
        }
    }

    sendConfig(data: string): void {
        logger.debug(`Sending config: ${data}`);
        this.port.write(`#${data}#`);
    }

    async query(queryData: string): Promise<string[]> {
        this.queryCollectorAttached = true;
        this.port.write(`?:${queryData}\n`);
        return new Promise((resolve) => {this.queryCollector = resolve});
    }
};