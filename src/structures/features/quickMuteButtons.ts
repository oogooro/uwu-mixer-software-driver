import { MixerDevice } from '../mixerDevice';
import { Feature } from './feature';

export class QuickMuteButtons extends Feature {
    constructor(mixer: MixerDevice) {
        super('QUCK_MUTE_BUTTONS', mixer);
    }
}