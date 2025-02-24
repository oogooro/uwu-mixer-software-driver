export type Feature = 'QUCK_MUTE_BUTTONS' | 'RGB_LEDS' | 'DISPLAY';

export const MixerFeaturesFlags: Record<Feature, number> = {
    QUCK_MUTE_BUTTONS: 1 << 0,
    RGB_LEDS: 1 << 1,
    DISPLAY: 1 << 2,
};