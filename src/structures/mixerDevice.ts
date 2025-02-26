import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer';
import { Command } from '../types/commandTypes';
import { MixerEvents, MixerOptions, PotMapValue } from '../types/mixerDevice';
import { SerialHandler } from './serialHandler';
import { Feature, MixerFeaturesFlags } from '../types/feature';
import logger from '../logger';
import EventEmitter from 'node:events';

export class MixerDevice extends EventEmitter<MixerEvents> {
    isInitialized: boolean = false;
    channels: boolean[];
    channelsOverrided = false;
    serial: SerialHandler;
    reversePotsPolarity: boolean;
    potMaps: PotMapValue[];
    protocolVersion: number;
    features: Feature[] = [];
    potsValues: number[] = [];
    private potsMapPids: number[][] = [];
    private processSeekerTriggered = false;
    private processSeekerInterval: NodeJS.Timeout;
    private deviceTimeout: NodeJS.Timeout;
    private hardAdjustInterval: NodeJS.Timeout;

    constructor(options: MixerOptions) {
        super();
        const { serialPort, baudRate, reversePotsPolarity, channels, potMaps, initializationTimeout } = options;

        this.isInitialized = false;

        this.reversePotsPolarity = reversePotsPolarity ?? false;
        
        if (channels) {
            this.channelsOverrided = true;
            this.channels = channels;
        }
        
        this.potMaps = potMaps ?? [];

        this.deviceTimeout = setTimeout(() => { 
            if (!this.isInitialized) {
                this.emit('error', new Error('Failed to initialize device'));
                this.destory();
            } 
        }, initializationTimeout ?? 5 * 1000 /* 5 sec*/);

        this.processSeekerInterval = setInterval(() => {
            if (this.isInitialized) this.processSeeker();
        }, 500);

        this.hardAdjustInterval = setInterval(() => {
            if (this.isInitialized) this.adjustVolumeLevels(this.potsValues, true); 
        }, 1000);
        
        this.serial = new SerialHandler(serialPort, baudRate);

        this.serial.once('connect', () => {
            this.emit('connect');
            logger.debug(`Device ${serialPort} connected`);
        });
        
        this.serial.on('command', (...commandData) => {
            const command = commandData.shift() as Command;

            if (command === 'r') {
                const [protocolVersion, numOfHardwareChannels, features] = commandData.map(Number);

                this.protocolVersion = protocolVersion;

                if (!this.channelsOverrided) this.channels = Array(numOfHardwareChannels).fill(true);

                let featureFlag: Feature;
                for (featureFlag in MixerFeaturesFlags) {
                    const flag = MixerFeaturesFlags[featureFlag];
                    if ((features & flag) !== 0) this.features.push(featureFlag);
                }

                // TODO: query for features data
                
                let config = '';
                for (let i = 0; i < this.channels.length; i++) if (this.channels[i]) config += i;
                if (this.reversePotsPolarity) config += 'r';
                
                this.serial.sendConfig(config);
                this.isInitialized = true;
                clearTimeout(this.deviceTimeout);
                this.emit('ready');
            }
        });

        this.serial.on('potsValues', (...pots) => {
            this.adjustVolumeLevels(pots)
        });

        this.serial.once('error', (error) => {
            clearInterval(this.processSeekerInterval);
            this.emit('error', error);
            this.destory();
        });

        this.serial.once('disconnect', () => {
            this.emit('disconnect');
            this.destory();
            logger.debug(`Device ${serialPort} disconnected`);
        });
    }

    adjustVolumeLevels(pots: number[], force = false): void {
        if (!this.isInitialized) return;
        if (!this.processSeekerTriggered) this.processSeeker();
        logger.debug(`Setting volume: ${pots.join(' ')} (${this.potsMapPids.map(pa => pa.join(' ')).join('|')})`);

        for (let i = 0; i < this.potMaps.length; i++) {
            const potValue = pots[i];
            if (isNaN(potValue)) continue;
            if (!force && potValue === this.potsValues[i]) continue;

            const potMapValue = this.potMaps[i];
            if (potMapValue === 'master') NodeAudioVolumeMixer.setMasterVolumeLevelScalar(potValue / 100);
            else {
                if (!Array.isArray(this.potsMapPids[i])) continue;
                for (const pid of this.potsMapPids[i]) {
                    NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(pid, potValue / 100);
                }
            }
        }
        this.potsValues = pots;
    }

    private processSeeker(): void {
        this.processSeekerTriggered = true;
        const audioProcesses = NodeAudioVolumeMixer.getAudioSessionProcesses();
        for (let i = 0; i < this.potMaps.length; i++) {
            if (!this.channels[i]) continue; // channel disabled
            if (this.potMaps[i] === 'master') continue; // channel mapped to master

            this.potsMapPids[i] = [];
            for (const processName of this.potMaps[i]) {
                this.potsMapPids[i].push(...audioProcesses.filter(p => p.name.toLowerCase().includes(processName.toLowerCase())).map(p => p.pid));
            }
        }
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