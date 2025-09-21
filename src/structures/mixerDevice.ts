import { IncomingCommand } from '../types/commands';
import { MixerEvents, MixerOptions } from '../types/mixerDevice';
import { SerialCommand, SerialCommandOutgoingOpcodes, SerialHandler } from './serialHandler';
import logger from '../logger';
import EventEmitter from 'node:events';
import { Oled } from './oled';
import { Channel } from './channel';

export class MixerDevice extends EventEmitter<MixerEvents> {
    isInitialized: boolean = false;
    serial: SerialHandler;
    channels: Channel[];
    channelsMuted: boolean[] = [];
    protocolVersion?: number;
    channelValues: number[] = [];
    handledChannels = 0;
    hardwareVersion?: number;
    hardwareChannels?: number;
    oled: Oled;
    private processSeekerInterval?: NodeJS.Timeout;
    private deviceTimeout: NodeJS.Timeout;
    private hardAdjustInterval: NodeJS.Timeout;
    private buttonsPressed = 0;

    constructor(options: MixerOptions) {
        super();

        const { serialPort, baudRate, config, initializationTimeout } = options;

        this.isInitialized = false;
        this.channels = config.channels.map((c, i) => new Channel({ ...{ name: `Channel ${i + 1}`, }, ...c, }));

        this.deviceTimeout = setTimeout(() => { 
            if (!this.isInitialized) {
                this.emit('error', new Error('Failed to initialize device'));
                this.destory();
            } 
        }, initializationTimeout ?? 5 * 1000 /* 5 sec*/);

        this.hardAdjustInterval = setInterval(() => {
            if (this.isInitialized) this.adjustVolumeLevels(this.channelValues, true); 
        }, 1000);
        
        this.serial = new SerialHandler(serialPort, baudRate);

        this.oled = new Oled(this.serial);

        this.serial.once('connect', () => {
            this.emit('connect');
            logger.debug(`Device ${serialPort} connected`);
        });
        
        this.serial.on('data', (...commandData) => {
            const command = commandData.shift() as Exclude<IncomingCommand, '='>;

            if (command === '$') {
                const [protocolVersion, hwVer, hwChannels] = commandData.map(Number);
        
                if (protocolVersion !== 2) {
                    this.emit('error', new Error('Protocol version not supported'));
                    this.destory();
                    return;
                }

                this.protocolVersion = protocolVersion;
                this.hardwareVersion = hwVer;
                this.hardwareChannels = hwChannels;
                this.handledChannels = Math.min(this.channels.length, this.hardwareChannels);
                this.channelsMuted = new Array(this.handledChannels).fill(false);

                if (hwChannels != this.channels.length) {
                    this.emit('warning', `Number of channels does not match config. Hardware channels ${hwChannels} - configured ${this.channels.length}`);
                }

                const reversedPolarityChannels: number[] = [];

                for (let i = 0; i < this.handledChannels; i++) {
                    const channel = this.channels[i];

                    if (channel.polarityReversed) reversedPolarityChannels.push(i);

                    if (channel.bind === 'device') {
                        this.channelsMuted[i] = channel.device.mute;

                        channel.device.on('mute', (muted: boolean) => {
                            this.channelsMuted[i] = muted;
                            this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsSet(...this.channelsMuted));
                        });
                    }
                }

                if (reversedPolarityChannels.length) {
                    this.serial.sendCommand(SerialCommandOutgoingOpcodes.config, ...SerialCommand.configReversedPolarityChannels(...reversedPolarityChannels));
                }

                this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsBrightness(config.ledBrightness));
                
                this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsSet(...this.channelsMuted));

                this.serial.sendCommand(SerialCommandOutgoingOpcodes.oled, ...SerialCommand.oledRegisterChannelNames(this.channels.map(c => c.name)));

                this.serial.sendCommand(SerialCommandOutgoingOpcodes.init);

                this.isInitialized = true;
                clearTimeout(this.deviceTimeout);
                this.emit('ready');
            } else if (command === 'b') {
                const buttons = Number(commandData.shift());
                for (let i = 0; i < this.handledChannels; i++) {
                    if (!!(buttons & (1 << i)) && !(this.buttonsPressed & (1 << i))) {
                        const muting = !this.channelsMuted[i]
                        this.channelsMuted[i] = muting;

                        this.channels[i].setMute(muting);

                        logger.debug(muting ? `Muted channel ${i}` : `Unmuted channel ${i}`);

                        if (this.oled) {
                            this.oled.displayMute(i, !muting);
                        }
                    }
                }

                this.buttonsPressed = buttons;

                this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsSet(...this.channelsMuted));
            } else if (command === '#') {
                this.emit('message', ...commandData.map(d => Buffer.from(d, 'base64').toString()));
            } else {
                if (!this.isInitialized) {
                    this.emit('error', new Error(`Expected mixer boot command ($). Got ${command} instead.`));
                    this.destory();
                } else {
                    this.emit('warning', `Unknown command: ${command}`);
                }
            }
        });

        this.serial.on('potsValues', (...chValues) => {
            if (this.channelValues.length) {
                let changedValue: number = NaN;
                let changedChannelIndex: number;
                
                for (let channelIndex = 0; channelIndex < this.handledChannels; channelIndex++) {
                    if (chValues[channelIndex] !== this.channelValues[channelIndex]) {
                        changedValue = chValues[channelIndex];
                        changedChannelIndex = channelIndex;
                        break;
                    }
                }

                if (!isNaN(changedValue)) {
                    this.oled.displayVolume(Math.round(changedValue), changedChannelIndex!);
                }
            }

            this.adjustVolumeLevels(chValues);
        });

        this.serial.once('error', (error) => {
            this.emit('error', error);
            this.destory();
        });

        this.serial.once('disconnect', () => {
            this.emit('disconnect');
            this.destory();
            logger.debug(`Device ${serialPort} disconnected`);
        });
    }

    adjustVolumeLevels(channels: number[], force = false): void {
        if (!this.isInitialized) return;
        logger.debug(`Setting volume: ${channels.join(' ')}`);
        const t = performance.now();

        for (let i = 0; i < this.handledChannels; i++) {
            const channelVolume = channels[i];
            if (isNaN(channelVolume)) continue;
            if (!force && channelVolume === this.channelValues[i]) continue;
            
            this.channels[i].setVolume(channelVolume);
        }
        this.channelValues = channels;
        logger.debug(`Volume adjust took ${performance.now() - t}ms`);
    }

    destory(): void {
        clearInterval(this.processSeekerInterval);
        clearTimeout(this.deviceTimeout);
        clearInterval(this.hardAdjustInterval);
        if (this.serial.port.isOpen) this.serial.port.close();
        this.serial.port.removeAllListeners();
        this.removeAllListeners();
        this.serial.removeAllListeners();
    }
};