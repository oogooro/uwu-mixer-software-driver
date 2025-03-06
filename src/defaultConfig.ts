import { MixerConfig } from './types/mixerConfig';

export const defaultConfig = {
    reversePolarity: false,
    potMaps: [
        'master',
        ['spotify'],
        ['chrome', 'brave', 'firefox', 'opera'],
        [],
        ['discord'],
    ],
} satisfies MixerConfig;