import { ChannelBindValue } from './mixerDevice';

export type ChannelConfig = {
    bindedApps: ChannelBindValue;
    reversePolarity?: boolean;
    logharitmic?: boolean;
    muteButton?: boolean;
    ledIndicator?: boolean;
};

export interface MixerConfig {
    channels: ChannelConfig[];
};