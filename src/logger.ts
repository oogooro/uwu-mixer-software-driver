import { Logger, LoggerOptions } from 'log4uwu';
import moment from 'moment';

const loggerOptions: LoggerOptions = {
    transports: [
        `${__dirname}/../logs/${moment(new Date()).format('D-M-YY-HH-mm-ss')}-${process.env.ENV}.log`,
        `${__dirname}/../logs/latest-${process.env.ENV}.log`,
    ],
    debugMode: process.env.DEBUG_MODE === '1',
}

const logger = new Logger(loggerOptions);

export default logger;