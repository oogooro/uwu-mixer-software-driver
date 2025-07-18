export interface ChannelHardwareConfig {
    polarityReversed?: boolean;
};

export interface ChannelRenderConfig extends ChannelHardwareConfig {
    type: 'render';
    processes?: string[];
    device?: string;
};

export interface ChannelCaptureConfig extends ChannelHardwareConfig {
    type: 'capture';
    device?: string;
};

export type ChannelConfig = ChannelRenderConfig | ChannelCaptureConfig

export interface MixerConfig {
    channels: ChannelConfig[];
};