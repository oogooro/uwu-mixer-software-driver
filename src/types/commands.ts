export type IncomingCommand = 
    '$' | // boot
    '=' | // channel values
    'b' | // buttons
    '#';  // mixer debug

export type OutgoingCommand = 
    'i' | // initalize mixer
    'l' | // set leds
    'r' | // read channel values
    'c' | // config
    'o';

export interface ISerialCommandOutgoingOpcodes extends Record<string, OutgoingCommand> {
    init: 'i';
    oled: 'o';
    leds: 'l';
    forceRead: 'r';
    config: 'c';
}