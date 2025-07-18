import { MixerConfig } from './mixerConfig';

export type MixerOptions = {
    serialPort: string;
    baudRate: number;
    config: MixerConfig;
    initializationTimeout?: number;
};

export interface MixerEvents {
    connect: never[];
    ready: never[];
    disconnect: never[];
    error: Error[];
    warning: string[];
    message: string[];
}