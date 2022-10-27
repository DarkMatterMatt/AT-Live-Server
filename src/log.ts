import { inspect } from "node:util";
import chalk, { type Chalk } from "chalk";
import jsonStringify_ from "fast-safe-stringify";
import { type TransformableInfo } from "logform";
import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

const logLevels = ["debug", "verbose", "info", "warn", "error"] as const;

type LogLevel = typeof logLevels[number];

const colors: { [K in LogLevel]: Chalk } = {
    error: chalk.bold.redBright,
    warn: chalk.bold.yellowBright,
    info: chalk.bold.greenBright,
    verbose: chalk.bold.cyanBright,
    debug: chalk.bold.whiteBright,
};

const isPrimitive = (val: any) => val === null || (typeof val !== "object" && typeof val !== "function");

const formatWithInspect = (val: any): string => {
    if (typeof val === "string") {
        return val;
    }
    const errorPrefix = val instanceof Error ? val.toString() : "";
    const newLine = isPrimitive(val) ? "" : "\n";
    return errorPrefix + newLine + inspect(val, { depth: null, colors: true });
};

const jsonStringifyErrors = (_key: string, value: any) => {
    if (value instanceof Error) {
        const { name, message, stack } = value;
        return { name, message, stack };
    }
    return value;
};

const jsonStringify = (obj: any) => jsonStringify_(obj, jsonStringifyErrors);

const EXTRA_DATA = Symbol("EXTRA_DATA");

interface ExtraData {
    label: string;
    moreObjects: any[];
}

const extractData = (info: TransformableInfo) => ({
    ...info[EXTRA_DATA as any] as ExtraData,
    message: info.message,
    level: info.level as LogLevel,
    timestamp: info.timestamp as string,
});

const log = createLogger({
    transports: [
        new transports.DailyRotateFile({
            level: "info",
            filename: "%DATE%.log",
            maxFiles: "14d",
            format: format.combine(
                format.timestamp(),
                format.printf(info => jsonStringify(extractData(info))),
            ),
        }),
        new transports.Console({
            level: "debug",
            format: format.combine(
                format.timestamp({ format: "MMM DD, HH:mm:ss" }),
                format.printf(info => {
                    const { label, level, timestamp, message, moreObjects } = extractData(info);
                    const coloredLabelLevel = colors[level](`${label}:${level}`);
                    const formattedObjs = moreObjects.map(formatWithInspect).join(" ");
                    return [timestamp, coloredLabelLevel, message, moreObjects.length ? formattedObjs : ""].join("  ");
                }),
            ),
        }),
    ],
});

const getLoggerLevel = (label: string, level: LogLevel) => (message: string, ...moreObjects: any[]) => {
    const extractData: ExtraData = { label, moreObjects };
    log.log(level, message, { [EXTRA_DATA]: extractData });
};

export const getLogger = (label: string) => Object.freeze(Object.fromEntries(
    logLevels.map(lvl => [lvl, getLoggerLevel(label, lvl)]),
) as { [K in LogLevel]: ReturnType<typeof getLoggerLevel> });
