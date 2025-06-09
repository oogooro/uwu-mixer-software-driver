import { MixerConfig } from './types/mixerConfig';

export const defaultConfig = {
    channels: [
        {
            bindedApps: 'master',
            logharitmic: false,
            reversePolarity: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            bindedApps: [ 'spotify', ],
            logharitmic: false,
            reversePolarity: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            bindedApps: [ 'chrome', 'brave', 'firefox', 'opera', ],
            logharitmic: false,
            reversePolarity: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            bindedApps: 'mic',
            logharitmic: false,
            reversePolarity: false,
            ledIndicator: true,
            muteButton: true,
        },
        {
            bindedApps: [ 'discord', ],
            logharitmic: false,
            reversePolarity: false,
            ledIndicator: true,
            muteButton: true,
        },
    ],
} satisfies MixerConfig;