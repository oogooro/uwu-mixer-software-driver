import { MixerConfig } from './types/mixerConfig';

export const defaultConfig = {
    channels: [
        {
            type: 'render',
            polarityReversed: false,
        },
        {
            type: 'render',
            processes: ['firefox', 'opera', 'spotify'],
            polarityReversed: false,
        },
        {
            type: 'render',
            processes: ['roblox'],
            polarityReversed: false,
        },
        {
            type: 'capture',
            polarityReversed: false,
        },
        {
            type: 'render',
            processes: ['discord'],
            polarityReversed: false,
        },
    ],
    ledBrightness: 255,
} satisfies MixerConfig;