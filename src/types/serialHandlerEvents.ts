export interface SerialHandlerEvents {
    connect: never[];
    error: Error[];
    disconnect: never[];
    potsValues: number[];
    data: string[];
    debug: string[];
}