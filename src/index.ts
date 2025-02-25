#!/usr/bin/env node
if (!process.env.ENV) process.env.ENV = 'prod';
import logger from './logger';
import { MixerDevice } from './structures/mixerDevice';
import { SerialPort } from 'serialport';
import { select } from '@inquirer/prompts';

const createMixer = (port: string, baudRate = 115200): void => {
    const mixer = new MixerDevice({
        serialPort: port,
        baudRate: baudRate,
        reversePotsPolarity: true,
        potMaps: [
            'master',
            ['spotify'],
            ['firefox'],
            ['speed', 'cs2', 'factorio'], // games
            ['discord'],
        ],
    });

    mixer.once('connect', () => {
        logger.log({
            level: 'info',
            message: 'Mixer connected',
            color: 'green',
        });
    });

    mixer.once('ready', () => {
        logger.log({
            level: 'info',
            message: 'Mixer ready',
            color: 'greenBright',
        });
    });

    mixer.once('disconnect', () => {
        logger.log({
            level: 'info',
            message: 'Mixer disconnected',
            color: 'gray',
        });
    });
};

SerialPort.list().then(ports => {
    select({
        message: 'Select mixer port',
        choices: ports.map((port) => {
            return {
                // @ts-expect-error
                name: port.friendlyName || port.path,
                value: port.path,
            };
        })
    }).then((mixerPort) => createMixer(mixerPort));
});