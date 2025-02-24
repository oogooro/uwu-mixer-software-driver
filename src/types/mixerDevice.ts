export type MixerOptions = {
    serialPort: string;
    baudRate: number;
    channels?: boolean[];
    potMaps?: PotMapValue[];
    reversePotsPolarity?: boolean;
};

export type PotMapValue = 'master' | string[];

export interface MixerEvents {
    connect: never[];
    ready: never[];
    disconnect: never[];
}