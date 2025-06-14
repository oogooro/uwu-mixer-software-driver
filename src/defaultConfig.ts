import { MixerConfig } from './types/mixerConfig';

export const defaultConfig = {
    channels: [
        {
            type: 'render',
            polarityReversed: false,
            logharitmic: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            type: 'render',
            processes: ['firefox', 'opera', 'spotify'],
            polarityReversed: false,
            logharitmic: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            type: 'render',
            processes: ['roblox'],
            polarityReversed: false,
            logharitmic: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            type: 'capture',
            polarityReversed: false,
            logharitmic: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            type: 'render',
            processes: ['discord'],
            polarityReversed: false,
            logharitmic: false,
            ledIndicator: true,
            muteButton: true,
        },
    ],
} satisfies MixerConfig;