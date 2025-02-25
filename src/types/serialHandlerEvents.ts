export interface SerialHandlerEvents {
    connect: never[];
    error: Error[];
    disconnect: never[];
    potsValues: number[];
    command: string[];
    queryResponse: string[];
}