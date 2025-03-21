export type DataType = '#' // Command
    | '=' // Pots values
    | '?' // Query request
    | '!' // Query response
    | '^' // Custom communication / Feature
    ;
export type Command = 'r';