import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer';
import { IncomingCommand } from '../types/commands';
import { MixerEvents, MixerOptions } from '../types/mixerDevice';
import { SerialHandler } from './serialHandler';
import logger from '../logger';
import EventEmitter from 'node:events';
import { ChannelConfig } from '../types/mixerConfig';

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
    private channelBindPids: number[][] = [];
    private processSeekerTriggered = false;
    private processSeekerInterval: NodeJS.Timeout;
    private deviceTimeout: NodeJS.Timeout;
    private hardAdjustInterval: NodeJS.Timeout;
    private oledActiveTimeout: NodeJS.Timeout;

    constructor(options: MixerOptions) {
        super();
        const { serialPort, baudRate, channelConfig, initializationTimeout } = options;

        this.isInitialized = false;
        this.channels = channelConfig;

        this.deviceTimeout = setTimeout(() => { 
            if (!this.isInitialized) {
                this.emit('error', new Error('Failed to initialize device'));
                this.destory();
            } 
        }, initializationTimeout ?? 5 * 1000 /* 5 sec*/);

        this.processSeekerInterval = setInterval(() => {
            if (this.isInitialized) this.processSeeker();
        }, 200);

        this.hardAdjustInterval = setInterval(() => {
            if (this.isInitialized) this.adjustVolumeLevels(this.channelValues, true); 
        }, 1000);
        
        this.serial = new SerialHandler(serialPort, baudRate);

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
                this.channelsMuted = Array(this.handledChannels).fill(false);
                this.channelBindPids = new Array(this.handledChannels).fill([]);

                if (hwChannels != this.channels.length) {
                    this.emit('warning', `Number of channels does not match config. Hardware channels ${hwChannels} - configured ${this.channels.length}`);
                }

                this.processSeeker();

                const reversedPolarityChannels: number[] = [];
                const logharitmicChannels: number[] = [];

                for (let i = 0; i < this.handledChannels; i++) {
                    const channel = this.channels[i];

                    if (channel.reversePolarity) reversedPolarityChannels.push(i);
                    if (channel.logharitmic) logharitmicChannels.push(i);
                }

                if (reversedPolarityChannels.length) {
                    this.serial.sendCommand('c', 0, ...reversedPolarityChannels);
                }

                if (logharitmicChannels.length) {
                    this.serial.sendCommand('c', 1, ...logharitmicChannels);
                }

                this.serial.sendCommand('i');

                this.isInitialized = true;
                clearTimeout(this.deviceTimeout);
                this.emit('ready');
            } else if (command === 'b') {
                const buttons = Number(commandData.shift());
                for (let i = 0; i < this.handledChannels; i++) {
                    if (!!(buttons & (1 << i))) {
                        const muting = !this.channelsMuted[i]
                        this.channelsMuted[i] = muting;
                        if (channelConfig[i].bindedApps === 'master') NodeAudioVolumeMixer.muteMaster(muting);
                        else if (channelConfig[i].bindedApps === 'mic') {} // TODO: handle MIC 
                        else for (const pid of this.channelBindPids[i]) NodeAudioVolumeMixer.setAudioSessionMute(pid, muting);

                        logger.debug(muting ? `Muted channel ${i}` : `Unmuted channel ${i}`);

                        this.setOledActive();
                        this.serial.sendCommand('o', 3, muting ? 0 : 1, i);
                    }
                }

                this.serial.sendCommand('l', ...this.channelsMuted.map(v => v ? 255 : 0));
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
                let changedValue: number;
                
                for (let i = 0; i < this.handledChannels; i++) {
                    if (chValues[i] !== this.channelValues[i]) {
                        changedValue = chValues[i];
                        break;
                    }
                }

                this.setOledActive();
                this.serial.sendCommand('o', 0, changedValue);
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
        if (!this.processSeekerTriggered) this.processSeeker();
        logger.debug(`Setting volume: ${channels.join(' ')} (${this.channelBindPids.map(pa => pa.join(' ')).join('|')})`);

        for (let i = 0; i < this.handledChannels; i++) {
            const channelValue = channels[i];
            if (isNaN(channelValue)) continue;
            if (!force && channelValue === this.channelValues[i]) continue;

            const channelBind = this.channels[i].bindedApps;
            if (channelBind === 'master') NodeAudioVolumeMixer.setMasterVolumeLevelScalar(channelValue / 100);
            else if (channelBind === 'mic') {} // TODO: MIC CHANNEL BIND
            else {
                if (!Array.isArray(this.channelBindPids[i])) continue;
                for (const pid of this.channelBindPids[i]) {
                    NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(pid, channelValue / 100);
                }
            }
        }
        this.channelValues = channels;
    }

    private processSeeker(): void {
        this.processSeekerTriggered = true;
        const audioProcesses = NodeAudioVolumeMixer.getAudioSessionProcesses();
        for (let i = 0; i < this.handledChannels; i++) {
            const channel = this.channels[i];

            if (channel.bindedApps === 'master') {
                if (NodeAudioVolumeMixer.isMasterMuted() && !this.channelsMuted[i]) {
                    this.channelsMuted[i] = true;
                    this.serial.sendCommand('l', ...this.channelsMuted.map(v => v ? 255 : 0));
                } else if (!NodeAudioVolumeMixer.isMasterMuted() && this.channelsMuted[i]) {
                    this.channelsMuted[i] = false;
                    this.serial.sendCommand('l', ...this.channelsMuted.map(v => v ? 255 : 0));
                }
                continue;
            } else if (channel.bindedApps === 'mic') {
                continue;
            }

            this.channelBindPids[i] = [];
            for (const processName of channel.bindedApps) {
                this.channelBindPids[i].push(...audioProcesses.filter(p => p.name.toLowerCase().includes(processName.toLowerCase())).map(p => p.pid));
                
                for (const pid of this.channelBindPids[i]) {
                    if (this.channelsMuted[i] && !NodeAudioVolumeMixer.isAudioSessionMuted(pid)) NodeAudioVolumeMixer.setAudioSessionMute(pid, true);
                    else if (!this.channelsMuted[i] && NodeAudioVolumeMixer.isAudioSessionMuted(pid)) NodeAudioVolumeMixer.setAudioSessionMute(pid, false);
                }
            }
        }
    }

    private setOledActive() {
        if (this.oledActiveTimeout) {
            clearTimeout(this.oledActiveTimeout);
        }

        this.oledActiveTimeout = setTimeout(() => {
            this.serial.sendCommand('o', 1);
        }, 1500);
    }

    destory(): void {
        clearInterval(this.processSeekerInterval);
        clearTimeout(this.deviceTimeout);
        clearInterval(this.hardAdjustInterval);
        this.serial.port.removeAllListeners();
        this.serial.port.end();
        this.removeAllListeners();
        this.serial.removeAllListeners();
    }
};