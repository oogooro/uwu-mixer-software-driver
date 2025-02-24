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

    constructor(options: MixerOptions) {
        super();
        const { serialPort, baudRate, reversePotsPolarity, channels, potMaps } = options;

        this.isInitialized = false;

        this.reversePotsPolarity = reversePotsPolarity ?? false;
        
        if (channels) {
            this.channelsOverrided = true;
            this.channels = channels;
        }
        
        this.potMaps = potMaps ?? [];
        
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
                this.emit('ready');
            }
        });

        this.processSeekerInterval = setInterval(() => {
            if (this.isInitialized) this.processSeeker();
        }, 500);

        this.serial.on('potsValues', (...pots) => {
            if (!this.isInitialized) return;
            if (!this.processSeekerTriggered) this.processSeeker();
            for (let i = 0; i < this.potMaps.length; i++) {
                const potValue = pots[i];
                if (isNaN(potValue) || potValue === this.potsValues[i]) continue;

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
        });

        this.serial.once('disconnect', () => {
            clearInterval(this.processSeekerInterval);
            this.emit('disconnect');
            logger.debug(`Device ${serialPort} disconnected`);
        });
    }

    private processSeeker() {
        this.processSeekerTriggered = true;
        const audioProcesses = NodeAudioVolumeMixer.getAudioSessionProcesses();
        for (let i = 0; i < this.potMaps.length; i++) {
            if (!this.channels[i]) continue; // channel disabled
            if (this.potMaps[i] === 'master') continue; // channel mapped to master
            
            for (const processName of this.potMaps[i]) {
                this.potsMapPids[i] = audioProcesses.filter(p => p.name.toLowerCase().includes(processName.toLowerCase())).map(p => p.pid);
            }
        }
    }
};