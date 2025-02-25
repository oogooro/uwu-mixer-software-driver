#!/usr/bin/env node
if (!process.env.ENV) process.env.ENV = 'prod';
import logger from './logger';
import { MixerDevice } from './structures/mixerDevice';
import { SerialPort } from 'serialport';
import { select } from '@inquirer/prompts';
import { Command } from 'commander';

const program = new Command();
program
    .name('uwu-mixer-driver')
    .description('CLI uwu mixer driver')
    .option('-p --port <string>', 'Mixer port')
    .option('-b --baudrate <number>', 'Mixer baudrate. Default 115200')
    .helpOption('-h', 'Show this');

program.parse();

const options = program.opts();
const baudRate: number = Number(options.baudrate) || 115200;
const comPort: string = options.port;

const createMixer = (port: string): void => {
    const mixer = new MixerDevice({
        serialPort: port,
        baudRate,
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
            message: 'Mixer initializing...',
            color: 'cyanBright',
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

    mixer.once('error', (error) => {
        logger.error(error);
        process.exit(1);
    });
};

if (comPort) createMixer(comPort);
else {
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
}