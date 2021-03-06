import chalk from "chalk";
import { createLogger, format, transports } from "winston";
import { inspect } from "util";
import { SPLAT } from "triple-beam";
import jsonStringify_ from "fast-safe-stringify";
import C from "./config";
import "winston-daily-rotate-file";

if (!C.logger) C.logger = {};

const colors: Record<string, any> = C.logger.colors || {
    error:   "redBright",
    warn:    "yellowBright",
    info:    "greenBright",
    http:    "greenBright",
    verbose: "cyanBright",
};

const isPrimitive = (val: any) => val === null || (typeof val !== "object" && typeof val !== "function");

const formatWithInspect = (val: any): string => {
    if (typeof val === "string") {
        return val;
    }
    const newLine = isPrimitive(val) ? "" : "\n";
    return newLine + inspect(val, { depth: null, colors: true });
};

export const colorize = (color: string, s: string): string => {
    if (!color) return s;
    // Chalk is designed to be indexed by a string
    const bold = (chalk.bold as unknown) as Record<string, (s: string) => string>;
    if (typeof bold[color] !== "function") throw new Error(`Invalid console text color: '${color}'`);
    return bold[color](s);
};

const jsonStringifyErrors = (key: string, value: any) => {
    if (value instanceof Error) {
        return Object.fromEntries(Object.entries(value));
    }
    return value;
};

const jsonStringify = (obj: any) => jsonStringify_(obj, jsonStringifyErrors);

const logger = createLogger(C.logger.opts || {
    transports: [
        new transports.DailyRotateFile({
            level:    C.logger.logLevel || "info",
            filename: C.logger.logFile || "combined_%DATE%.log",
            maxFiles: "14d",
            format:   format.combine(
                format.timestamp(),
                format.errors({ stack: true }),
                format.printf(info => {
                    // SPLAT is always a valid index for TransformableInfo
                    const splatArgs = info[(SPLAT as unknown) as string];
                    if (splatArgs) {
                        const messagesArr = [info.message].concat(splatArgs);
                        // this is NOT a string but jsonStringify isn't fussy
                        info.message = ((messagesArr as unknown) as string);
                    }
                    return jsonStringify(info);
                })
            ),
        }),
        new transports.Console({
            level:  "debug",
            format: format.combine(
                format.timestamp({ format: "MMM DD, HH:mm:ss" }),
                format.printf(info => {
                    const coloredLevel = colorize(colors[info.level], info.level.padEnd(7));
                    const msg = formatWithInspect(info.message);
                    // SPLAT is always a valid index for TransformableInfo
                    const splatArgs = info[(SPLAT as unknown) as string] || [];
                    const rest = splatArgs.map(formatWithInspect).join(" ");
                    return `${info.timestamp}  ${coloredLevel}  ${msg} ${rest}`;
                })
            ),
        }),
    ],
});

export default logger;
