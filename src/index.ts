#!/usr/bin/env node
if (!process.env.ENV) process.env.ENV = 'prod';
import logger from './logger';
import { MixerDevice } from './structures/mixerDevice';

export const mixer = new MixerDevice({
    serialPort: 'COM9',
    baudRate: 115200,
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