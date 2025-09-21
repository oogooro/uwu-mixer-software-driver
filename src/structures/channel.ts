import soundMixer, { AudioSession, Device, DeviceType } from 'native-sound-mixer';
import { ChannelBindType, ChannelConfig, ChannelType } from '../types/mixerConfig';
import logger from '../logger';

export class Channel {
    private volume = 0;
    name: string;
    device: Device;
    config: ChannelConfig;
    type: ChannelType;
    bind: ChannelBindType; 
    polarityReversed: boolean;
    constructor(config: ChannelConfig) {
        this.config = config;
        this.polarityReversed = !!config.polarityReversed;
        this.type = config.type;
        this.name = config.name || 'channel';

        if (config.type === 'render' && config.processes?.length) {
            this.bind = 'process';
        } else {
            this.bind = 'device';
        }

        if (!config.device) {
            this.device = soundMixer.getDefaultDevice(this.deviceTypeStringToEnum(config.type));
        } else {
            const deviceFound = soundMixer.devices.find(d => d.name === config.device);

            if (!deviceFound) {
                throw new Error('Device not found');
            } else if (this.deviceTypeStringToEnum(config.type) !== deviceFound.type) {
                throw new Error('Invalid device type');
            }

            this.device = deviceFound;
        }
    }

    getProcesses(): AudioSession[] {
        if (this.bind !== 'process') {
            throw new Error('Channel not bound to audio processes');
        }

        return this.device.sessions.filter(s => this.config.processes!.some(p => s.appName.replaceAll('\\', '/').split('/').at(-1)!.toLowerCase().includes(p.toLowerCase())));
    }

    getVolume(): number {
        if (this.bind === 'process') {
            return Math.round(this.device.volume * 100);
        } else {
            return this.volume;
        }
    }

    setVolume(targetVolume: number): void {
        const p = performance.now();
        if (targetVolume < 0) {
            targetVolume = 0;
        } else if (targetVolume > 100) {
            targetVolume = 100;
        }

        if (this.bind === 'process') {
            for (const process of this.getProcesses()) {
                process.volume = targetVolume / 100;
            }
        } else {
            this.device.volume = targetVolume / 100;
        }

        logger.debug(`setVolume took ${(performance.now() - p).toFixed(2)}ms`);
    }

    setMute(mute: boolean): void {
        if (this.bind === 'process') {
            for (const process of this.getProcesses()) {
                process.mute = mute;
            }
        } else {
            this.device.mute = mute;
        }
    }

    private deviceTypeStringToEnum(stringDeviceType: string): DeviceType {
        return stringDeviceType === 'render' ? DeviceType.RENDER : DeviceType.CAPTURE;
    }
}