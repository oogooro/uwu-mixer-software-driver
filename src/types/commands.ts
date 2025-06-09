export type IncomingCommand = 
    '$' | // boot
    '=' | // channel values
    'b' | // buttons
    '#';  // mixer debug
export type OutgoingCommand = 
    'i' | // initalize mixer
    'l' | // set leds
    'r' | // read channel values
    'c';  // config