export interface ChannelConfig {
    name?: string;
    polarityReversed?: boolean;
    processes?: string[];
    device?: string;
    type: ChannelType;
};

export type ChannelType = 'render' | 'capture';
export type ChannelBindType = 'device' | 'process';

export interface MixerConfig {
    channels: ChannelConfig[];
    // Brightness in 0-255;
    ledBrightness: number;
};