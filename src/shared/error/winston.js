import winston from 'winston';
import 'winston-daily-rotate-file';

const filterWarn = winston.format((info) => info.level === 'warn' ? info : false);
const filterError = winston.format((info) => info.level === 'error' ? info : false);

export const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.DailyRotateFile({
            filename: 'logs/connection/connection-%DATE%.log',
            level: 'warn',
            maxSize: '10m',
            maxFiles: '14d',
            zippedArchive: true,
            format: winston.format.combine(filterWarn())
        }),
        new winston.transports.DailyRotateFile({
            filename: 'logs/fatal/fatal-%DATE%.log',
            level: 'error',
            maxSize: '10m',
            maxFiles: '30d',
            zippedArchive: true,
            format: winston.format.combine(filterError())
        }),
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});
