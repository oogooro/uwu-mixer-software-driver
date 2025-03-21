import { FeatureId } from '../../types/feature'
import { MixerDevice } from '../mixerDevice';

export class Feature {
    name: FeatureId;
    mixer: MixerDevice;

    constructor (name: FeatureId, mixer: MixerDevice) {
        this.name = name;
        this.mixer = mixer;
    }
}