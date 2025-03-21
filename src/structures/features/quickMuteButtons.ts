import { MixerDevice } from '../mixerDevice';
import { Feature } from './feature';

export class QuickMuteButtons extends Feature {
    constructor(mixer: MixerDevice) {
        super('MUTE_PUSH_BUTTONS', mixer);
    }
}