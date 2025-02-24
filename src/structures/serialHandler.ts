import { SerialPort } from 'serialport';
import { EventEmitter } from 'node:events';
import { SerialHandlerEvents } from '../types/serialHandlerEvents';
import logger from '../logger';
import { DataType } from '../types/commandTypes';

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
            logger.debug(`Data: ${rawData}`);

            if (rawData.includes('\n')) { // we got at least one whole data packet
                const dataSplitted = rawData.split('\n');
                partialData = dataSplitted.pop() ?? '';
                for (const data of dataSplitted) this.handleData(data);
            }
        });

        this.port.on('error', (error) => {
            this.connected = false;

            this.emit('disconnect');

            logger.error(error);
        });

        this.port.on('close', () => {
            this.connected = false;

            this.emit('disconnect');

            logger.log({
                level: 'info',
                message: `Port ${serialPortPath} closed`,
                color: 'grey',
            });
        });

        this.port.open();
    }

    private handleData(data: string): void {
        const dataType = data.charAt(0) as DataType;
        const args = data.slice(1).split(':');

        logger.debug(`Command: ${dataType}`);
        logger.debug(`Args: ${args.join(' ')}`);

        if (dataType === '$') {
            this.emit('command', ...args);
        } else if (dataType === '=') {
            this.emit('potsValues', ...args.map(Number));
        } else if (dataType === '*') {
            this.emit('queryResponse', ...args);
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
};