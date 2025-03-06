#!/usr/bin/env node
if (!process.env.ENV) process.env.ENV = 'prod';
import logger from './logger';
import { MixerDevice } from './structures/mixerDevice';
import { SerialPort } from 'serialport';
import { select } from '@inquirer/prompts';
import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLIOptions } from './types/CLIOptions';
import { defaultConfig } from './defaultConfig';
import { MixerOptions } from './types/mixerDevice';
import { MixerConfig } from './types/mixerConfig';

const defaultConfigPath = join(__dirname, '../config.json');
logger.debug(`Default config path: ${defaultConfigPath}`);

const program = new Command();
program
    .name('uwu-mixer-driver')
    .description('CLI uwu mixer driver')
    .option('-p --port <string>', 'Mixer port')
    .option('-b --baudrate <number>', 'Mixer baudrate. Default 115200')
    .helpOption('-h', 'Show this');

program.parse();

const options = program.opts<CLIOptions>();
const baudRate = Number(options.baudrate) || 115200;
const comPort = options.port;
const configPath = defaultConfigPath;

const getConfig = (path: string): MixerConfig => {
    return JSON.parse(readFileSync(path, { encoding: 'utf8', }));
};

const createMixer = (options: MixerOptions): void => {
    const mixer = new MixerDevice(options);

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

if (!existsSync(configPath)) writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));

const config = getConfig(configPath);
const potMaps = config.potMaps;
const reversePotsPolarity = config.reversePolarity;

if (comPort) createMixer({ serialPort: comPort, baudRate, potMaps, reversePotsPolarity, });
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
        }).then((mixerPort) => createMixer({ serialPort: mixerPort, baudRate, potMaps, reversePotsPolarity, }));
    });
}