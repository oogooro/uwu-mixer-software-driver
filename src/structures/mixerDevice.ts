import nativeMixer, { AudioSession, Device, DeviceType } from 'native-sound-mixer';
import { IncomingCommand } from '../types/commands';
import { MixerEvents, MixerOptions } from '../types/mixerDevice';
import { SerialCommand, SerialCommandOutgoingOpcodes, SerialHandler } from './serialHandler';
import logger from '../logger';
import EventEmitter from 'node:events';
import { ChannelConfig } from '../types/mixerConfig';
import { Oled } from './oled';

export class MixerDevice extends EventEmitter<MixerEvents> {
    isInitialized: boolean = false;
    serial: SerialHandler;
    channels: ChannelConfig[];
    channelsMuted: boolean[];
    protocolVersion: number;
    channelValues: number[] = [];
    handledChannels: number;
    hardwareVersion: number;
    hardwareChannels: number;
    oled: Oled;
    private processSeekerInterval: NodeJS.Timeout;
    private deviceTimeout: NodeJS.Timeout;
    private hardAdjustInterval: NodeJS.Timeout;
    private buttonsPressed = 0;

    constructor(options: MixerOptions) {
        super();

        const { serialPort, baudRate, config, initializationTimeout } = options;

        this.isInitialized = false;
        this.channels = config.channels;

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

                    if ((channel.type === 'render' && !channel.processes) || channel.type === 'capture') {
                        const dev = this.getAudioDevice(channel.device, channel.type);
                        this.channelsMuted[i] = dev.mute;

                        dev.on('mute', (muted: boolean) => {
                            this.channelsMuted[i] = muted;
                            this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsSet(...this.channelsMuted));
                        });
                    }
                }

                if (reversedPolarityChannels.length) {
                    this.serial.sendCommand(SerialCommandOutgoingOpcodes.config, ...SerialCommand.configReversedPolarityChannels(...reversedPolarityChannels));
                }

                this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsSet(...this.channelsMuted));

                console.log(SerialCommand.ledsBrightness(config.ledBrightness))

                this.serial.sendCommand(SerialCommandOutgoingOpcodes.leds, ...SerialCommand.ledsBrightness(config.ledBrightness));

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

                        const channel = this.channels[i];
                        const device = this.getAudioDevice(channel.device, channel.type);
                        
                        if (channel.type === 'render' && channel.processes) { // processes
                            device.sessions.filter(this.getSessionFilter(i)).forEach(as => { as.mute = muting; });
                        } else { // device master mute
                            device.mute = muting;
                        }

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
            chValues = chValues.map(v => v / 100);
            if (this.channelValues.length) {
                let changedValue: number;
                
                for (let i = 0; i < this.handledChannels; i++) {
                    if (chValues[i] !== this.channelValues[i]) {
                        changedValue = chValues[i];
                        break;
                    }
                }

                if (!isNaN(changedValue)) {
                    this.oled.displayVolume(Math.round(changedValue * 100));
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
            const channelValue = channels[i];
            if (isNaN(channelValue)) continue;
            if (!force && channelValue === this.channelValues[i]) continue;
            
            const channel = this.channels[i];
            const device = this.getAudioDevice(channel.device, channel.type);
            if (channel.type === 'render' && channel.processes) { // processes
                device.sessions.filter(this.getSessionFilter(i)).forEach(as => { as.volume = channelValue; });
            } else { // device master volume
                device.volume = channelValue;
            }
        }
        this.channelValues = channels;
        logger.debug(`Volume adjust took ${performance.now() - t}ms`);
    }

    private getSessionFilter(channelNum: number): (s: AudioSession) => boolean {
        const channel = this.channels[channelNum];
        if (channel.type === 'render') {
            return s => channel.processes.some(p => s.appName.replaceAll('\\', '/').split('/').at(-1).toLowerCase().includes(p.toLowerCase()));
        } else throw new Error('Channel type is not render');
    }

    private getAudioDevice(deviceName: string, type: ('render' | 'capture')): Device {
        return nativeMixer.devices.find(d => d.name === deviceName) ?? nativeMixer.getDefaultDevice(type === 'render' ? DeviceType.RENDER : DeviceType.CAPTURE);
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