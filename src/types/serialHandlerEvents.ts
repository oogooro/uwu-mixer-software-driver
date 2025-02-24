export interface SerialHandlerEvents {
    connect: never[];
    disconnect: never[];
    potsValues: number[];
    command: string[];
    queryResponse: string[];
}