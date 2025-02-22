import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer';
import { SerialPort } from 'serialport';
import logger from './logger';
import { DataType, Command } from './types/commandTypes';

const COMPORT = 'COM9';

const port = new SerialPort({
    path: COMPORT,
    baudRate: 115200,
    autoOpen: false,
});

const sendConfig = (data: string): void => {
    logger.debug(`Sending config: ${data}`);
    port.write(`#${data}#`);
};

const handleData = (data: string): void => {
    const dataType = data.charAt(0) as DataType;
    const args = data.slice(1).split(':');

    logger.debug(`Data: ${data}`);
    logger.debug(`Command: ${dataType}`);
    logger.debug(`Args: ${args.join(' ')}`);

    if (dataType === '$') {
        const command = args.shift() as Command;

        if (command === 'r') {
            const [protocolVersion, channels, features] = args;

            logger.log({
                level: 'info',
                message: `Protocol: v${protocolVersion}\nChannels: ${channels}\nFeatures: ${features}`,
                color: 'green',
            });

            sendConfig('01234');
        } else {
            logger.log({
                level: 'warn',
                message: 'Unknown command',
                color: 'yellowBright',
            });
        }
    } else if (dataType === '=') {
        NodeAudioVolumeMixer.setMasterVolumeLevelScalar(parseInt(args[4])/100);
    } else {
        logger.log({
            level: 'warn',
            message: 'Unknown data type',
            color: 'yellowBright',
        });
    }
};

port.on('open', () => {
    logger.log({
        level: 'info',
        message: `Port ${port.settings.path} opened`,
        color: 'greenBright',
    });
});

let leftoverData = '';

port.on('data', (data: Buffer) => {
    const stringData = leftoverData + data.toString();
    leftoverData = '';

    if (stringData.includes('\n')) {
        const dataSplitted = stringData.split('\n');
        const lastData = dataSplitted.pop();

        if (lastData !== '') leftoverData = lastData;

        for (const command of dataSplitted) {
            handleData(command);
        }
    }
});

port.on('error', (error) => {
    logger.error(error);
});

port.on('close', () => {
    logger.log({
        level: 'info',
        message: `Port ${port.settings.path} closed`,
        color: 'grey',
    });
});

port.open();