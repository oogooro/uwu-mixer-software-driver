import { ChannelConfig } from './mixerConfig';

export type MixerOptions = {
    serialPort: string;
    baudRate: number;
    channelConfig: ChannelConfig[];
    initializationTimeout?: number;
};

export type ChannelBindValue = 'master' | 'mic' | string[];

export interface MixerEvents {
    connect: never[];
    ready: never[];
    disconnect: never[];
    error: Error[];
    warning: string[];
    message: string[];
}